USE [DButilities]
GO
/****** Object:  StoredProcedure [dbo].[sp_update_task_status]    Script Date: 02-03-2026 11:15:32 ******/
SET ANSI_NULLS ON
GO
SET QUOTED_IDENTIFIER ON
GO

ALTER PROCEDURE [dbo].[sp_update_task_status]
    @execution_log_id  BIGINT,
    @action_type       INT,
    @action_by         BIGINT,
    @remarks           NVARCHAR(MAX),
    @extended_date     DATETIME = NULL
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @now DATETIME = GETDATE();
    DECLARE @current_status INT;
    DECLARE @new_status INT;
    DECLARE @task_id BIGINT;
    DECLARE @emp_id BIGINT;
    DECLARE @assigned_by BIGINT;

    BEGIN TRY
        BEGIN TRANSACTION;

        -- Fetch execution row
        SELECT 
            @current_status = task_status,
            @task_id = task_id,
            @emp_id = emp_id,
            @assigned_by = assigned_by
        FROM task_execution_log
        WHERE id = @execution_log_id;

        IF @current_status IS NULL
        BEGIN
            SELECT 'Execution log not found' AS message, 0 AS success,
                   NULL AS task_id, NULL AS emp_id, NULL AS assigned_by,
                   NULL AS action_type, NULL AS new_status;
            ROLLBACK;
            RETURN;
        END

        -- Map action to new status
        SET @new_status =
            CASE @action_type
                WHEN 1 THEN 1   -- STARTED
                WHEN 2 THEN 2   -- SUBMITTED
                WHEN 3 THEN 3   -- COMPLETED
                WHEN 4 THEN 4   -- REJECTED
                WHEN 5 THEN 5   -- RESUBMITTED
                WHEN 6 THEN 6   -- CANCELLED
                WHEN 7 THEN @current_status -- EXTENDED (no status change)
                WHEN 9 THEN 8   -- ALLOW EARLY START (sets status to 8)
                ELSE -1
            END;

        IF @new_status = -1
        BEGIN
            SELECT 'Invalid action type' AS message, 0 AS success,
                   NULL AS task_id, NULL AS emp_id, NULL AS assigned_by,
                   NULL AS action_type, NULL AS new_status;
            ROLLBACK;
            RETURN;
        END

        -- STARTED
    IF @action_type = 1
BEGIN
    -- New Logic: Prevent Early Starts (Instance-aware for recurring tasks)
    DECLARE @task_actual_start_date DATETIME;
    DECLARE @task_type_check INT;
    
    SELECT @task_type_check = td.task_type,
           @task_actual_start_date = CASE 
                WHEN td.task_type IN (1, 2, 3) AND el.instance_deadline IS NOT NULL AND el.instance_deadline <= '2099-12-31'
                THEN CAST(el.instance_deadline AS DATE)
                ELSE td.task_start_date 
           END
    FROM task_execution_log el
    JOIN task_details td ON el.task_id = td.task_id
    WHERE el.id = @execution_log_id;
    
    -- Block if early AND not explicitly allowed by manager (status 8)
    IF CAST(@now AS DATE) < CAST(@task_actual_start_date AS DATE) AND @current_status <> 8
    BEGIN
        SELECT 'You cannot start this task before its planned start date. Ask your manager to allow early start.' AS message, 0 AS success,
               NULL AS task_id, NULL AS emp_id, NULL AS assigned_by,
               NULL AS action_type, NULL AS new_status;
        ROLLBACK;
        RETURN;
    END

    UPDATE task_execution_log
    SET task_status = 1,
        started_at  = @now,
        updated_at  = @now
    WHERE id = @execution_log_id;
END

    -- ALLOW EARLY START (Action Type 9 -> Status 8)
    ELSE IF @action_type = 9
    BEGIN
        IF @action_by <> @assigned_by
        BEGIN
            SELECT 'Only the task assigner can allow early start' AS message, 0 AS success,
                   NULL AS task_id, NULL AS emp_id, NULL AS assigned_by,
                   NULL AS action_type, NULL AS new_status;
            ROLLBACK;
            RETURN;
        END

        DECLARE @group_id BIGINT;
        SELECT @group_id = group_id FROM task_execution_log WHERE id = @execution_log_id;

        IF @group_id IS NOT NULL
        BEGIN
            -- Group task: propagate early start to ALL active members of this group
            UPDATE task_execution_log
            SET task_status = 8,
                updated_at = @now
            WHERE task_id = @task_id
              AND group_id = @group_id
              AND task_status = 0
              AND is_active = 1;
        END
        ELSE
        BEGIN
            -- Individual task: update only this execution log row
            UPDATE task_execution_log
            SET task_status = 8,
                updated_at = @now
            WHERE id = @execution_log_id;
        END

        SELECT 'Early start allowed for this task' AS message, 1 AS success,
               @task_id AS task_id, @emp_id AS emp_id, @assigned_by AS assigned_by, 9 AS action_type, 8 AS new_status;
        
        COMMIT;
        RETURN;
    END

        -- REJECTED
        ELSE IF @action_type = 4
        BEGIN
            UPDATE task_execution_log
            SET task_status = @new_status,
                rejection_count = rejection_count + 1,
                updated_at = @now
            WHERE id = @execution_log_id;
        END

        -- EXTENDED
        ELSE IF @action_type = 7
        BEGIN
            IF @extended_date IS NULL
            BEGIN
                SELECT 'Extended date required' AS message, 0 AS success,
                       NULL AS task_id, NULL AS emp_id, NULL AS assigned_by,
                       NULL AS action_type, NULL AS new_status;
                ROLLBACK;
                RETURN;
            END

            -- Save exactly what user selected (no auto shift)
            UPDATE task_execution_log
            SET extended_date = @extended_date,
                instance_deadline = @extended_date, -- Sync with instance_deadline
                updated_at = @now
            WHERE id = @execution_log_id;
        END

        -- All other status changes
        ELSE
        BEGIN
            UPDATE task_execution_log
            SET task_status = @new_status,
                updated_at = @now
            WHERE id = @execution_log_id;
        END

        -- NEW: Deactivate master task if cancelled (Moved outside ELSE block for reliability)
        IF @action_type = 6
        BEGIN
            UPDATE task_details 
            SET is_active = 0 
            WHERE task_id = @task_id;
        END

        -- ─────────────────────────────────────────────
        -- NEW: Group Synchronization Logic
        -- ─────────────────────────────────────────────
        DECLARE @group_id_val BIGINT;
        DECLARE @is_team_lead_val BIT;

        SELECT @group_id_val = group_id, @is_team_lead_val = is_team_lead 
        FROM task_execution_log WHERE id = @execution_log_id;

        IF @group_id_val IS NOT NULL
        BEGIN
            -- Sync if: 
            -- 1. Action is by a Manager (Status 3, 4, 6, 7 often manager actions)
            -- 2. Action is by Team Lead (Start/Submit/Resubmit)
            DECLARE @should_sync BIT = 0;
            IF @is_team_lead_val = 1 SET @should_sync = 1;
            IF @action_by = @assigned_by SET @should_sync = 1;

            IF @should_sync = 1
            BEGIN
                -- Sync status to all other active group members
                UPDATE task_execution_log
                SET task_status = @new_status,
                    started_at = CASE WHEN @action_type = 1 AND started_at IS NULL THEN @now ELSE started_at END,
                    extended_date = CASE WHEN @action_type = 7 THEN @extended_date ELSE extended_date END,
                    instance_deadline = CASE WHEN @action_type = 7 THEN @extended_date ELSE instance_deadline END,
                    rejection_count = CASE WHEN @action_type = 4 THEN rejection_count + 1 ELSE rejection_count END,
                    updated_at = @now
                WHERE group_id = @group_id_val
                  AND id <> @execution_log_id
                  AND is_active = 1;

                -- Insert history for each member
                INSERT INTO task_execution_history (execution_log_id, action_type, action_by, remarks, action_at)
                SELECT id,
                    @action_type,
                    @action_by,
                    'Group Sync: ' + 
                    CASE 
                        WHEN @action_type = 7 THEN 'Deadline extended to ' + CONVERT(VARCHAR(19), @extended_date, 120)
                        WHEN @is_team_lead_val = 1 THEN 'Synced from Team Lead'
                        ELSE 'Synced from Manager Action'
                    END + 
                    CASE WHEN @remarks IS NOT NULL AND @remarks <> '' THEN ' (' + @remarks + ')' ELSE '' END,
                    @now
                FROM task_execution_log
                WHERE group_id = @group_id_val
                  AND id <> @execution_log_id
                  AND is_active = 1;
            END
        END

        -- Insert history with smart default remarks for the primary row
        INSERT INTO task_execution_history (
            execution_log_id,
            action_type,
            action_by,
            remarks,
            action_at
        )
        VALUES (
            @execution_log_id,
            @action_type,
            @action_by,
            CASE
                -- EXTENDED
                WHEN @action_type = 7 THEN
                    CONCAT(
                        'Deadline extended to ',
                        CONVERT(VARCHAR(19), @extended_date, 120),
                        CASE 
                            WHEN @remarks IS NOT NULL 
                                 AND LTRIM(RTRIM(@remarks)) <> ''
                            THEN CONCAT(' - ', @remarks)
                            ELSE ''
                        END
                    )

                -- STARTED default
                WHEN @action_type = 1
                     AND (@remarks IS NULL OR LTRIM(RTRIM(@remarks)) = '')
                     THEN 'Task started'

                -- REJECTED default
                WHEN @action_type = 4
                     AND (@remarks IS NULL OR LTRIM(RTRIM(@remarks)) = '')
                     THEN 'Task rejected'

                -- COMPLETED default
                WHEN @action_type = 3
                     AND (@remarks IS NULL OR LTRIM(RTRIM(@remarks)) = '')
                     THEN 'Task completed'

                ELSE @remarks
            END,
            @now
        );

        COMMIT;

        SELECT 'Status updated successfully' AS message, 1 AS success,
               @task_id AS task_id,
               @emp_id AS emp_id,
               @assigned_by AS assigned_by,
               @action_type AS action_type,
               @new_status AS new_status;

    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0
            ROLLBACK;

        SELECT ERROR_MESSAGE() AS message, 0 AS success,
               NULL AS task_id, NULL AS emp_id, NULL AS assigned_by,
               NULL AS action_type, NULL AS new_status;
    END CATCH
END

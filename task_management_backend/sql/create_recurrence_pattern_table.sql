USE [DButilities]
GO

IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[recurrence_pattern]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[recurrence_pattern](
        [pattern_id] [bigint] IDENTITY(1,1) PRIMARY KEY,
        [task_id] [bigint] NOT NULL,
        [recurrence_type] [varchar](10) NULL, -- 'DAILY', 'WEEKLY', 'MONTHLY'
        [start_date] [date] NULL,
        [end_date] [date] NULL,
        [weekly_days] [varchar](100) NULL, -- '0' or 'Monday,Tuesday...'
        [monthly_day_of_month] [int] NULL,
        [created_at] [datetime] NULL,
        [updated_at] [datetime] NULL,
        CONSTRAINT [FK_recurrence_pattern_task_details] FOREIGN KEY([task_id])
        REFERENCES [dbo].[task_details] ([task_id])
    ) ON [PRIMARY]
END
GO

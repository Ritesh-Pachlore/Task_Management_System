import React, { useState } from 'react';

const ActionModal = ({ title, onSubmit, onClose, showDate = false }) => {
    const [remarks, setRemarks] = useState('');
    const [extendedDate, setExtendedDate] = useState('');

    const handleSubmit = () => {
        onSubmit({ remarks, extended_date: extendedDate });
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                {showDate && (
                    <div className="form-group">
                        <label>New Deadline</label>
                        <input
                            type="date"
                            className="form-control"
                            value={extendedDate}
                            onChange={(e) => setExtendedDate(e.target.value)}
                            min={new Date().toISOString().split('T')[0]}
                        />
                    </div>
                )}

                <div className="form-group">
                    <label>Remarks</label>
                    <textarea
                        className="form-control"
                        value={remarks}
                        onChange={(e) => setRemarks(e.target.value)}
                        placeholder="Enter remarks..."
                        rows={3}
                    />
                </div>

                <div className="modal-footer">
                    <button className="btn btn-outline" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn btn-primary" onClick={handleSubmit}>
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ActionModal;
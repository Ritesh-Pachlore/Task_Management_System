import React from 'react';
import { MdWarning } from 'react-icons/md';

const DateShiftModal = ({ shiftInfo, onShift, onKeep, onClose }) => {
    if (!shiftInfo || !shiftInfo.needs_shift) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3><MdWarning style={{ color: '#FF9800' }} /> Date Alert</h3>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>

                <p style={{ fontSize: '15px', marginBottom: '12px' }}>
                    {shiftInfo.message}
                </p>

                <div style={{ 
                    background: '#FFF3E0', padding: '12px', 
                    borderRadius: '8px', marginBottom: '16px', fontSize: '13px' 
                }}>
                    <p><strong>Original:</strong> {shiftInfo.original_date}</p>
                    <p><strong>Reason:</strong> {shiftInfo.reason}</p>
                    <p><strong>Suggested:</strong> {shiftInfo.suggested_date}</p>
                </div>

                <div className="modal-footer">
                    <button
                        className="btn btn-outline"
                        onClick={() => onKeep(shiftInfo.original_date)}
                    >
                        Keep {shiftInfo.original_date}
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => onShift(shiftInfo.suggested_date)}
                    >
                        Shift to {shiftInfo.suggested_date}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DateShiftModal;
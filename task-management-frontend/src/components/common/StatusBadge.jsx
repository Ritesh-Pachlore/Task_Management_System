import React from 'react';
import { STATUS_MAP } from '../../utils/constants';

const StatusBadge = ({ status }) => {
    const info = STATUS_MAP[status] || { name: 'UNKNOWN', color: '#999', bg: '#f5f5f5' };

    return (
        <span
            className="badge"
            style={{ color: info.color, background: info.bg }}
        >
            {info.name}
        </span>
    );
};

export default StatusBadge;
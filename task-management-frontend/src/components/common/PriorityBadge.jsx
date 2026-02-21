import React from 'react';
import { PRIORITY_MAP } from '../../utils/constants';

const PriorityBadge = ({ priority }) => {
    const info = PRIORITY_MAP[priority] || { name: '?', color: '#999', bg: '#f5f5f5' };

    return (
        <span
            className="badge"
            style={{ color: info.color, background: info.bg }}
        >
            {info.name}
        </span>
    );
};

export default PriorityBadge;
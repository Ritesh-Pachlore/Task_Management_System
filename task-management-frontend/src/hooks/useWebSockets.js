// src/hooks/useWebSockets.js
import { useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from '../api/axios';

/**
 * useWebSockets
 * - Connects to the Django Channels WebSocket for the logged-in employee.
 * - Calls onMessage(data) whenever the server broadcasts a notification.
 * - Auto-reconnects every 3s if the connection drops.
 *
 * To change the server, update API_BASE_URL in src/api/axios.js — no other file needs changing.
 */
const useWebSockets = (onMessage) => {
    const socketRef = useRef(null);
    const reconnectTimer = useRef(null);

    // Derive emp_id from the stored user object (same pattern as AuthContext)
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    const empId = user?.emp_id;

    // Converts http(s):// → ws(s):// so we always match the server protocol
    const wsBaseUrl = API_BASE_URL.replace(/^http/, 'ws');

    // Stabilise the callback so it doesn't trigger a reconnect loop
    const stableOnMessage = useCallback(onMessage, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!empId) return;

        const socketUrl = `${wsBaseUrl}/ws/tasks/${empId}/`;

        const connect = () => {
            // Don't double-connect
            if (socketRef.current &&
                (socketRef.current.readyState === WebSocket.OPEN ||
                    socketRef.current.readyState === WebSocket.CONNECTING)) {
                return;
            }

            console.log(`[WS] Connecting to ${socketUrl}`);
            socketRef.current = new WebSocket(socketUrl);

            socketRef.current.onopen = () => {
                console.log('[WS] Connected');
                clearTimeout(reconnectTimer.current);
            };

            socketRef.current.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    console.log('[WS] Message received:', message);
                    if (stableOnMessage && message.data) {
                        stableOnMessage(message.data);
                    }
                } catch (e) {
                    console.error('[WS] Failed to parse message', e);
                }
            };

            socketRef.current.onclose = (e) => {
                console.warn(`[WS] Closed (code=${e.code}). Reconnecting in 3s…`);
                reconnectTimer.current = setTimeout(connect, 3000);
            };

            socketRef.current.onerror = (err) => {
                console.error('[WS] Error:', err);
                socketRef.current?.close(); // triggers onclose → auto-reconnect
            };
        };

        connect();

        return () => {
            clearTimeout(reconnectTimer.current);
            socketRef.current?.close();
        };
    }, [empId, wsBaseUrl, stableOnMessage]);

    return socketRef.current;
};

export default useWebSockets;

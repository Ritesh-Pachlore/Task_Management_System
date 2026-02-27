
"""
JWT Authentication — No Login Required
───────────────────────────────────────
Token generated via dev-token endpoint.
No password. Just provide emp_id.

Token payload: {"emp_id": 380988, "emp_name": "Ritesh Pachlore", "exp": ..., "iat": ...}
No is_manager — any user can assign and receive tasks.
"""

import jwt
import datetime
from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed


class SimpleUser:
    """Lightweight user object attached to request.user"""
    def __init__(self, emp_id, emp_name):
        self.emp_id = emp_id
        self.emp_name = emp_name

    @property
    def is_authenticated(self):
        return True

    @property
    def is_anonymous(self):
        return False

    def __str__(self):
        return f"{self.emp_name} (ID: {self.emp_id})"


def generate_token(emp_id, emp_name):
    """Generate JWT token for any employee. No password check."""
    payload = {
        'emp_id': emp_id,
        'emp_name': emp_name,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(
            hours=settings.JWT_EXPIRATION_HOURS
        ),
        'iat': datetime.datetime.utcnow(),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm='HS256')


class StandaloneTokenAuthentication(BaseAuthentication):
    """Validates JWT token from Authorization: Bearer <token> header."""

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')
        print(f"DEBUG: Auth Header: {auth_header[:20]}...") 

        if not auth_header.startswith('Bearer '):
            print("DEBUG: No Bearer token found")
            return None

        token = auth_header.replace('Bearer ', '').strip()
        if not token:
            print("DEBUG: Token is empty")
            return None

        try:
            payload = jwt.decode(
                token, settings.JWT_SECRET_KEY, algorithms=['HS256']
            )
            print(f"DEBUG: Token Decoded. Emp ID: {payload.get('emp_id')}")
            user = SimpleUser(
                emp_id=payload.get('emp_id'),
                emp_name=payload.get('emp_name', 'Unknown'),
            )
            return (user, token)

        except jwt.ExpiredSignatureError:
            print("DEBUG: Token Expired")
            raise AuthenticationFailed('Token expired. Generate a new one.')
        except jwt.InvalidTokenError as e:
            print(f"DEBUG: Invalid Token: {str(e)}")
            raise AuthenticationFailed('Invalid token.')
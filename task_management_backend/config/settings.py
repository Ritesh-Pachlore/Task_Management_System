"""
Django Settings — STANDALONE MODE
─────────────────────────────────
• Own JWT authentication (no Java dependency)
• Single database (DButilities)
• CORS enabled for React frontend
• No Django models (all data through stored procedures)
"""

from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

# Security key for Django internals (not the JWT key)
SECRET_KEY = 'django-insecure-task-mgmt-standalone-key-change-in-production'

# Debug mode — set False in production
DEBUG = True

# Allow all hosts in development
ALLOWED_HOSTS = ['*']


# ════════════════════════════════════════
# INSTALLED APPS
# ════════════════════════════════════════
INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.auth', 
    'django.contrib.staticfiles',
     'django.contrib.sessions',
    'rest_framework',          # Django REST Framework
    'corsheaders',             # CORS for React
    'apps.authentication',     # Our auth app
    'apps.tasks',              # Our tasks app
]


# ════════════════════════════════════════
# MIDDLEWARE
# Minimal — no sessions, no CSRF (API-only project)
# ════════════════════════════════════════
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',    # Must be first
    'django.middleware.common.CommonMiddleware',
]


# ════════════════════════════════════════
# CORS — Allow React frontend to call our API
# In production, restrict to your domain
# ════════════════════════════════════════
CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True


# ════════════════════════════════════════
# DATABASE — SQL Server
# ⚠️ CHANGE these values to match your setup
# ════════════════════════════════════════
DATABASES = {
    'default': {
        'ENGINE': 'mssql',
        'NAME': 'DButilities',
        'USER': 'sa',                    # ⚠️ CHANGE: your SQL username
        'PASSWORD': 'sa@123',      # ⚠️ CHANGE: your SQL password
        'HOST': 'localhost',             # ⚠️ CHANGE: your SQL server
        'PORT': '1433',
        'OPTIONS': {
            'driver': 'ODBC Driver 17 for SQL Server',
        },
    }
}


# ════════════════════════════════════════
# REST FRAMEWORK
# Every API requires JWT token (except login)
# ════════════════════════════════════════
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.authentication.token_auth.StandaloneTokenAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
}


# ════════════════════════════════════════
# JWT SETTINGS (Standalone)
# Our own key — not shared with anyone
# ════════════════════════════════════════
JWT_SECRET_KEY = "standalone-task-mgmt-secret-key-2025"
JWT_EXPIRATION_HOURS = 24    # Token valid for 24 hours


# ════════════════════════════════════════
# OTHER SETTINGS
# ════════════════════════════════════════
ROOT_URLCONF = 'config.urls'
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
STATIC_URL = 'static/'
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'
USE_TZ = False   # We use SQL Server's GETDATE()

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
            ],
        },
    },
]




# from pathlib import Path
# BASE_DIR = Path(__file__).resolve().parent.parent
# SECRET_KEY = 'django-insecure-change-in-production'
# DEBUG = True
# ALLOWED_HOSTS = ['*']
# INSTALLED_APPS = [
#     'django.contrib.contenttypes', 'django.contrib.staticfiles',
#     'rest_framework', 'corsheaders', 'channels',
#     'apps.authentication', 'apps.tasks',
# ]
# MIDDLEWARE = ['corsheaders.middleware.CorsMiddleware', 'django.middleware.common.CommonMiddleware']
# CORS_ALLOW_ALL_ORIGINS = True
# DATABASES = {
#     'default': {
#         'ENGINE': 'mssql', 'NAME': 'DButilities',
#         'USER': 'sa', 'PASSWORD': 'YourPassword',  # ⚠️ CHANGE
#         'HOST': 'localhost', 'PORT': '1433',
#         'OPTIONS': {'driver': 'ODBC Driver 17 for SQL Server'},
#     }
# }
# REST_FRAMEWORK = {
#     'DEFAULT_AUTHENTICATION_CLASSES': ['apps.authentication.token_auth.JavaTokenAuthentication'],
#     'DEFAULT_PERMISSION_CLASSES': ['rest_framework.permissions.IsAuthenticated'],
# }
# SHARED_SECRET_KEY = "your-shared-secret-key-must-match-java"  # ⚠️ CHANGE
# ASGI_APPLICATION = 'config.asgi.application'
# CHANNEL_LAYERS = {
#     'default': {'BACKEND': 'channels_redis.core.RedisChannelLayer',
#                 'CONFIG': {"hosts": [('127.0.0.1', 6379)]}},
# }
# ROOT_URLCONF = 'config.urls'
# DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
# STATIC_URL = 'static/'
# TEMPLATES = [{'BACKEND': 'django.template.backends.django.DjangoTemplates',
#               'DIRS': [], 'APP_DIRS': True,
#               'OPTIONS': {'context_processors': ['django.template.context_processors.request']}}]
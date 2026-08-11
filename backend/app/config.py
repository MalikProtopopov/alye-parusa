"""Конфигурация приложения (env-driven). Раздел 07 ТЗ — параметры через ENV."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # БД
    database_url: str = "postgresql+psycopg2://parusa:parusa@localhost:5432/parusa"

    # Auth (демо-значения; в проде — из секрет-хранилища)
    jwt_secret: str = "dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_ttl_min: int = 720  # для демо длиннее, чем 15 мин из ТЗ

    # CORS — оба фронта локально
    cors_origins: str = "http://localhost:3000,http://localhost:3001"

    # Уведомления о заявке (З13): Telegram Bot API; без токена — только лог
    notify_channel: str = "telegram"
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    # База админки — для ссылки «Открыть в админке» в уведомлении
    admin_url: str = "http://localhost:3001"

    # Фичефлаги (З1: заказчик может выключить ненужный блок в .env).
    # Выключенный флаг убирает публичные и админ-роуты сущности из роутера.
    feature_news: bool = True
    feature_faq: bool = True
    feature_advantages: bool = True
    feature_partners: bool = True
    feature_team: bool = True
    feature_documents: bool = True
    feature_calculator: bool = True
    feature_seo_admin: bool = True

    # Медиа-хранилище (drag-n-drop загрузка из админки)
    # local — файлы на диске/томе; s3 — S3-совместимое (MinIO в docker, S3 в проде)
    media_backend: str = "local"
    media_dir: str = "./media_files"
    media_max_mb: int = 10          # изображения/pdf
    media_max_video_mb: int = 200   # видео (транскодится в H.264 до 1280px)

    # S3/MinIO (используются при MEDIA_BACKEND=s3)
    s3_endpoint: str = "http://minio:9000"
    s3_bucket: str = "parusa-media"
    s3_access_key: str = "parusa"
    s3_secret_key: str = "parusa-secret"
    s3_region: str = "us-east-1"

    # Демо-учётки (сидируются при старте)
    seed_superadmin_email: str = "admin@alyeparusa.local"
    seed_superadmin_password: str = "admin12345"
    seed_manager_email: str = "manager@alyeparusa.local"
    seed_manager_password: str = "manager12345"

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()

"""E-Mail-Service via Python-stdlib smtplib (keine externe Abhängigkeit)."""
import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def send_email(smtp_config: dict, to: list[str], subject: str, body_html: str) -> bool:
    """Sendet eine HTML-E-Mail. Gibt False zurück wenn SMTP nicht konfiguriert oder Fehler."""
    host = smtp_config.get("smtp_host", "").strip()
    if not host:
        logger.debug("SMTP host not configured – skipping email")
        return False

    if not to:
        logger.debug("No recipients – skipping email")
        return False

    port = int(smtp_config.get("smtp_port", 587) or 587)
    user = smtp_config.get("smtp_user", "").strip()
    password = smtp_config.get("smtp_password", "").strip()
    from_addr = smtp_config.get("smtp_from", "").strip() or user
    use_tls = str(smtp_config.get("smtp_tls", "true")).lower() not in ("false", "0", "no")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = ", ".join(to)
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        if use_tls:
            server = smtplib.SMTP(host, port, timeout=10)
            server.ehlo()
            server.starttls()
            server.ehlo()
        else:
            server = smtplib.SMTP(host, port, timeout=10)

        if user and password:
            server.login(user, password)

        server.sendmail(from_addr, to, msg.as_string())
        server.quit()
        logger.info(f"Email sent to {to}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False

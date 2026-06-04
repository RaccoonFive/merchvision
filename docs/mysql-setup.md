# MySQL setup

Use the MySQL root account only for this one-time bootstrap. The application should connect with the restricted `merchvision_app` user through `DATABASE_URL`.

Rotate any root password that has been shared outside your password manager before deploying.

```sql
CREATE DATABASE merchvision
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'merchvision_app'@'127.0.0.1'
  IDENTIFIED BY 'replace-with-a-strong-generated-password';

GRANT ALL PRIVILEGES ON merchvision.* TO 'merchvision_app'@'127.0.0.1';
FLUSH PRIVILEGES;
```

Then configure the application and deploy the committed migration:

```bash
cp .env.example .env
# Set DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL, and USER_AGENT_CONTACT.
npm run db:generate
npm run db:migrate:deploy
```

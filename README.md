# AI Note Editor

A powerful note-taking application built with Laravel and React that features AI-powered note enhancement capabilities.

## Features

- User authentication with Google OAuth
- Create, edit, and delete notes
- AI-powered note enhancement features:
    - Summarize notes
    - Improve writing
    - Generate tags
    - Get insights on your content
- Markdown support
- Modern UI with Tailwind CSS and Radix UI

## Tech Stack

- **Backend**: Laravel 12.x
- **Frontend**: React 19.x with TypeScript
- **CSS**: Tailwind CSS 4.x
- **Database**: SQLite (default), configurable for other databases
- **Authentication**: Laravel Socialite with Google
- **AI Integration**: OpenAI API

## Requirements

- PHP 8.2 or higher
- Node.js 18.x or higher
- Composer
- SQLite (default) or MySQL/PostgreSQL

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/iqbalhasandev/laravel-ai-note-editor.git
cd laravel-ai-note-editor
```

### 2. Install PHP dependencies

```bash
composer install
```

### 3. Install JavaScript dependencies

```bash
npm install
```

### 4. Set up environment variables

Copy the `.env.example` file to `.env`:

```bash
cp .env.example .env
```

Generate a new application key:

```bash
php artisan key:generate
```

### 5. Set up the database

By default, the app uses SQLite. You need to create the database file and update your `.env` file:

```bash
touch database/database.sqlite
php artisan migrate
```

If you want to use MySQL or another database instead, update your `.env` file with the appropriate credentials:

```
DB_CONNECTION=sqlite
# DB_HOST=127.0.0.1
# DB_PORT=3306
# DB_DATABASE=laravel
# DB_USERNAME=root
# DB_PASSWORD=
```

Uncomment and modify the database connection details as needed, then run migrations:

```bash
php artisan migrate
```

If you want to seed the database with sample data:

```bash
php artisan db:seed
```

### 6. Build assets

```bash
npm run build
```

For development:

```bash
npm run dev
```

### 7. Start the development server

```bash
php artisan serve
```

## Environment Variables

The following environment variables need to be configured in your `.env` file:

### Application Settings

- `APP_NAME`: Application name ("Ai Note Editor")
- `APP_ENV`: Application environment (local, production, etc.)
- `APP_KEY`: Auto-generated application key
- `APP_DEBUG`: Enable debug mode (true/false)
- `APP_URL`: Base URL for your application

### Database Settings

- `DB_CONNECTION`: Database type (sqlite, mysql, pgsql)
- `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`: Required if using MySQL or PostgreSQL

### Google OAuth Settings

- `GOOGLE_CLIENT_ID`: Your Google OAuth client ID
- `GOOGLE_CLIENT_SECRET`: Your Google OAuth client secret
- `GOOGLE_REDIRECT_URI`: OAuth redirect URI (default: `[APP_URL]/auth/google/callback`)

### OpenAI Settings

- `OPENAI_API_KEY`: Your OpenAI API key
- `OPENAI_MODEL`: OpenAI model to use (default: gpt-4.1-nano-2025-04-14)

## Deployment Instructions

### Local Development

For local development, you can use Laravel's built-in server:

```bash
php artisan serve
```

And in a separate terminal:

```bash
npm run dev
```

Or use the convenience script:

```bash
composer run dev
```

### Production Deployment

#### 1. Server Requirements

- PHP 8.2+
- Composer
- Node.js 18+
- Web server (Apache or Nginx)

#### 2. Build for Production

```bash
npm run build
```

#### 3. Server Configuration

For Apache, ensure the document root points to the `public` directory.

Example Nginx configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/note-editor/public;

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";

    index index.php;

    charset utf-8;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    error_page 404 /index.php;

    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;
        include fastcgi_params;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

#### 4. Environment Setup

Make sure to set the appropriate environment variables:

```bash
APP_ENV=production
APP_DEBUG=false
```

#### 5. Optimize for Production

```bash
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

## Running Tests

```bash
composer test
```

## License

This project is licensed under the MIT License.


# Installation via docker / docker-compose (recommended):

- Image: https://hub.docker.com/r/byte21516/bookmarks

```
services:
  bookmarks:
    image: byte21516/bookmarks:latest
    container_name: bookmarks
    ports:
      - "3000:3000"
    volumes:
      - ./bookmarks-data:/app/data
    environment:
      NODE_ENV: production
    restart: unless-stopped
```

<hr>

# Manually installing Bookmarks (usually only needed for developers):

1. Installing NodeJS & NPM:

```
$ sudo curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install nodejs -y
```

2. Navigate to the directory or repository:

```
$ cd Bookmarks/
```
3. Inside the directory, run npm install:

```
$ sudo npm install
```

4. Run the NodeJS server:

```
$ node server.js
```

5. The server should now run on port 3000.

### Setting up autostart after rebooting:

- Using systemd service file.

<hr>

## Performing proper Backups:

Backups are pretty easy: Just backup "db.sqlite".

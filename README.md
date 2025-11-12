# Greenhouse Portal Dashboard

A web dashboard for visualizing sensor data, system metrics, and camera images from a greenhouse monitoring system. Built with Express.js, TypeScript, and vanilla JavaScript.

## Features

- **Real-time Data Display**: View current sensor readings (temperature, humidity) from multiple sensors
- **System Monitoring**: Monitor SOC temperature, WiFi signal strength, and storage usage
- **Image Viewing**: Display camera images that match the selected sensor data timestamp
- **Time Navigation**: Date picker and time slider to browse historical data
- **Temperature Units**: Toggle between Celsius and Fahrenheit
- **Auto-refresh**: Automatically updates every 30 seconds when viewing current data

## Architecture

- **Backend**: Express.js with TypeScript
- **Database**: SQLite with `better-sqlite3` (efficient for Raspberry Pi)
- **Frontend**: Vanilla TypeScript/JavaScript with modern CSS
- **Image Serving**: Filesystem-based image serving with path resolution

## Prerequisites

- Node.js 18+ (for Raspberry Pi 4, Node.js 18+ is recommended)
- npm or yarn
- SQLite database file with sensor data
- Image files stored on the filesystem

## Installation

1. Clone or navigate to the project directory:
   ```bash
   cd greenhouse-portal
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure environment variables (optional):
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` with your settings:
   ```
   DB_PATH=./data/greenhouse_data.sqlite
   IMAGE_BASE_DIR=/mnt/GreenhouseData/imgs
   PORT=3000
   ```

## Database Schema

The application expects a SQLite database with the following tables:

- `data_points`: Timestamp records
- `sensor_data`: Temperature and humidity readings from sensors
- `system_data`: System metrics (SOC temperature, WiFi, storage)
- `image_data`: Image file references linked to data points

See the sample database in `data/greenhouse_data.sqlite` for reference.

## Development

### Running in Development Mode

1. Start the development server:
   ```bash
   npm run dev
   ```

   This will:
   - Start the Express server with hot-reload
   - Serve the frontend from the compiled client code

2. Build the frontend (if needed):
   ```bash
   cd client
   npm run build
   ```

### Building for Production

1. Build both server and client:
   ```bash
   npm run build
   ```

2. Start the production server:
   ```bash
   npm start
   ```

## Configuration

### Environment Variables

- `DB_PATH`: Path to SQLite database file (default: `./data/greenhouse_data.sqlite`)
- `IMAGE_BASE_DIR`: Base directory for images (default: `/mnt/GreenhouseData/imgs`)
  - Note: Images in the database have absolute paths. The server extracts the relative path after `/imgs/` and serves from `IMAGE_BASE_DIR`.
- `PORT`: Server port (default: `3000`)

### Image Path Handling

The database stores absolute paths like `/mnt/GreenhouseData/imgs/2023/04/23/img_xxx.jpg`. The server:
1. Receives the full path from the client
2. Extracts the relative path after `/imgs/`
3. Serves the file from `IMAGE_BASE_DIR` + relative path

## API Endpoints

- `GET /api/data/current` - Get latest sensor/system data with matching image
- `GET /api/data/:timestamp` - Get data for a specific timestamp
- `GET /api/images/*` - Serve image files
- `GET /api/dates/:date/data-points` - Get all timestamps for a date (YYYY-MM-DD format)

## Deployment on Raspberry Pi 4

### Prerequisites

1. Install Node.js 18+ on Debian 11:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. Build the project on your development machine or on the Pi:
   ```bash
   npm install
   npm run build
   ```

### Running as a Service

Create a systemd service file `/etc/systemd/system/greenhouse-portal.service`:

```ini
[Unit]
Description=Greenhouse Portal Dashboard
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/path/to/greenhouse-portal
Environment="NODE_ENV=production"
Environment="DB_PATH=/path/to/greenhouse_data.sqlite"
Environment="IMAGE_BASE_DIR=/mnt/GreenhouseData/imgs"
Environment="PORT=3000"
ExecStart=/usr/bin/node /path/to/greenhouse-portal/server/dist/server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl enable greenhouse-portal
sudo systemctl start greenhouse-portal
```

### External Access

To access the dashboard externally:

1. Configure your router to forward port 3000 (or your chosen port) to the Raspberry Pi
2. Use the Pi's local IP address or set up a dynamic DNS service
3. Consider using a reverse proxy (nginx) with SSL for secure access

## Project Structure

```
greenhouse-portal/
├── server/              # Express backend
│   ├── src/
│   │   ├── db/         # Database layer
│   │   ├── routes/     # API routes
│   │   ├── types/      # TypeScript types
│   │   └── server.ts   # Main server file
│   └── package.json
├── client/             # Frontend
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── api/        # API client
│   │   ├── styles/     # CSS
│   │   └── app.ts       # Main app
│   ├── index.html
│   └── package.json
├── data/               # Database file location
└── package.json        # Root workspace config
```

## Troubleshooting

### Images not loading

- Verify `IMAGE_BASE_DIR` points to the correct directory
- Check file permissions on image files
- Ensure the path extraction logic matches your image storage structure

### Database connection errors

- Verify `DB_PATH` is correct and the file exists
- Check file permissions on the database file
- Ensure SQLite is properly installed

### Port already in use

- Change the `PORT` environment variable
- Or stop the process using the port: `sudo lsof -ti:3000 | xargs kill`

## License

MIT


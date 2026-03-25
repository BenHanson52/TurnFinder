# Turnfinder

Turnfinder is a full-stack web app for sharing and viewing off-season ski conditions in Colorado. Users can browse a map, view condition reports pinned to specific locations, create accounts, log in, upload photos, and add their own reports. The app is built around a Leaflet-based map frontend, a Node.js backend, and a MariaDB database, and is deployed on a Linux server with NGINX, PM2, and HTTPS.

## Features

- Interactive map interface using Leaflet
- User-created pins with location-specific condition reports
- Account creation and login
- Role-based users (`author` and `admin`)
- Image uploads for reports
- Multiple photos per pin
- Real-time updates using WebSockets
- Shareable pin links using latitude/longitude URL parameters
- Admin panel for viewing users
- Overlay layers for ski-related geographic data

## Tech Stack

  ### Frontend
  - HTML
  - CSS
  - JavaScript
  - Leaflet
  - Esri Leaflet
  - Leaflet Control Geocoder
  - browser-image-compression

  ### Backend
  - Node.js
  - Custom HTTP/HTTPS request handling
  - WebSocket support with `ws`
  
  ### Database
  - MariaDB
  
  ### Deployment
  - NGINX
  - PM2
  - Let's Encrypt / Certbot
  - Cloudflare DNS

## Project Structure

  ```text
  mapproj.html           # main frontend page
  mapproj_script.js      # frontend logic
  mapstyles.css          # frontend styling
  mapproj_server.js      # HTTPS/HTTP server and WebSocket setup
  mapproj_API.js         # backend request handling and API routes
  ecosystem.config.js    # PM2 config
  uploads/               # uploaded images
  ssl/                   # local/dev cert files

How It Works

  The frontend loads a Leaflet map and pulls pin data from the backend through API routes. Logged-in users can create new pins with descriptions and photos,
  while admins have access to additional controls. Uploaded images are compressed in the browser before being sent to the backend.
  The backend stores pin and user data in MariaDB and serves updates to connected clients through WebSockets.

User Roles <br>

Author

'''Create an account
'''Log in
'''Create pins
'''Edit/delete their own pins

Admin

'''All author permissions
'''View the admin panel
'''View user information
'''Edit/delete any pin
'''Local Development
This project has a development mode for local testing.

Typical local setup

  Run a local MariaDB instance
  
  Create a development database
  
  Configure local environment variables / PM2 dev config
  
  Start the server in development mode
  
  Open the site locally in a browser

Notes
  
  The production deployment uses HTTPS
  
  Local development may use a separate dev certificate or HTTP depending on config
  
  Some functionality, such as image uploads and auth, depends on the backend and database being configured correctly

Production Deployment

  The project is deployed on a Linux server with:
  
  NGINX serving the frontend and reverse proxying API traffic
  
  PM2 running the Node.js backend
  
  MariaDB storing user and pin data
  
  Cloudflare handling DNS
  
  Certbot providing HTTPS certificates
  
  Challenges / What I Learned
  
  This project involved more than frontend work. In building and deploying it, I had to work through:
  
  map-based frontend interaction
  
  user authentication and roles
  
  browser-side image handling
  
  backend request routing
  
  MariaDB schema and data management
  
  DNS setup
  
  NGINX routing and reverse proxy configuration
  
  SSL certificate issuance and renewal
  
  PM2 process management
  
  debugging deployment issues across multiple layers

One of the biggest lessons from this project was how much full-stack development depends on understanding how the frontend, backend, database, DNS, server config, and SSL all interact.

Current Limitations

  HEIC image uploads are not currently supported reliably
  
  The codebase could be cleaned up and modularized further
  
  Error handling and validation could be improved in several places
  
  Some deployment/configuration steps are still fairly manual
  
  Future Improvements
  
  Better upload validation and file-type handling
  
  Cleaner API structure
  
  More robust admin tools
  
  Improved mobile UX
  
  Better filtering/searching of reports
  
  Stronger documentation and setup automation
  
  Additional map overlays and trail/snow data integrations

Running Notes

This project was built as a practical full-stack deployment project and portfolio piece. It is not intended to be presented as a polished production SaaS app,
but as a working application that demonstrates frontend integration, backend logic, deployment, and debugging across a real server environment.

// BACKEND CODE (mapproj_API.js)

// ended up using mariadb on my server instead,
// but this still works, same creators as mysql
const mysql = require('mysql2');
 
const bcrypt = require('bcrypt');

const url = require('url');

// need to require http for dev env
const http  = require('http');
const https = require('https');
const fs = require('fs');

console.log("DB_HOST:", process.env.DB_HOST);
console.log("DB_USER:", process.env.DB_USER);
console.log("DB_PASSWORD:", process.env.DB_PASSWORD);
console.log("DB_NAME:", process.env.DB_NAME);
const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

async function createUser(username, plaintextPassword, role) {
    try {
        // every public account creation will be author, i prefer to create one admin on my DB.
        role = 'author';
        // hashing
        const saltRounds = 10; 
        const hashedPassword = await bcrypt.hash(plaintextPassword, saltRounds);
  
        // inserting users
        const sql = `
            INSERT INTO users (username, passwordHash, role)
            VALUES (?, ?, ?)
        `;
        const [result] = await connection.promise().execute(sql, [username, hashedPassword, role]);
  
        console.log('User created with ID:', result.insertId);
  
    } catch (error) {
        
        console.error('Error creating user:', error);
        throw error;
    }
}

// decodes auth header to get username of active user
function getUsernameFromAuth(req) {
    if (req.headers.authorization && req.headers.authorization.startsWith('Basic ')) {
        const base64Credentials = req.headers.authorization.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('utf8');
        // credentials should be in the format "username:password"
        return credentials.split(':')[0];
    }
    return null;
}

// function to get the user's role from my db
function getUserRole(username, callback) {
    connection.query('SELECT role FROM users WHERE username = ?', [username], (err, results) => {
        if (err || results.length === 0) {
            callback(err, null);
        } else {
            callback(null, results[0].role);
        }
    });
}

//creating the server
function requestHandler(req, res) {
    const parsedUrl = url.parse(req.url, true);
    console.log("Requested path:", parsedUrl.pathname);
    console.log("HTTP method:", req.method);

    // Login endpoint
    if (/^\/api\/login\/?$/.test(parsedUrl.pathname) && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const credentials = JSON.parse(body);
            // check for create account mode
            if (credentials.new_username && credentials.new_password) {
              // checks for creating account on login screen
              res.writeHead(400, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: 'Use account creation endpoint for new accounts' }));
            }
            const { username, password } = credentials;
            if (!username || !password) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: 'Missing username or password' }));
            }
            // checking against my backend DB
            connection.query('SELECT * FROM users WHERE username = ?', [username], (err, results) => {
              if (err || results.length === 0) {
                res.writeHead(401, { 
                  'Content-Type': 'application/json',
                  'WWW-Authenticate': 'Basic realm="Mapproj"'
                });
                return res.end(JSON.stringify({ error: 'Invalid credentials' }));
              }
              const user = results[0];
              // checking password against the hash w bcrypt
              bcrypt.compare(password, user.passwordHash, (err, valid) => {
                if (err || !valid) {
                  res.writeHead(401, { 
                    'Content-Type': 'application/json',
                    'WWW-Authenticate': 'Basic realm="Mapproj"'
                  });
                  return res.end(JSON.stringify({ error: 'Invalid credentials' }));
                }
                // good login
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ message: 'Login successful', role: user.role }));
              });
            });
          } catch (e) {
            //security check for invalid json
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Invalid JSON' }));
          }
        });
        return; 
    }

    // endpoint for account creation
    console.log("Parsed URL Path:", parsedUrl.pathname);
    if (/^\/api\/createAccount\/?$/i.test(parsedUrl.pathname) && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            // parsing incoming json
            const data = JSON.parse(body);
            const { new_username, new_password } = data;
            if (!new_username || !new_password) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              return res.end(JSON.stringify({ error: 'Missing new username or new password' }));
            }
            // attempt to create new user
            await createUser(new_username, new_password, 'author');
            res.writeHead(201, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ message: 'Account created successfully' }));
          } catch (dbError) {
            console.error('Error in createUser:', dbError);
            console.log(`[createAccount] dbError.code = "${dbError.code}"`);
            if (dbError.code === 'ER_DUP_ENTRY') {
                // checking for duplicate usernames
                res.writeHead(409, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Username already taken' }));
            }
            res.writeHead(500, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Error creating account', details: dbError.message }));
          }
        });
        return;
      }
      
    // admin endpoint, work in progress, need more functionality
    if (/^\/api\/admin\/users\/?$/.test(parsedUrl.pathname) && req.method === 'GET') {
        // get active users username from auth header
        const username = getUsernameFromAuth(req);
        if (!username) {
            res.writeHead(401, {
                'Content-Type': 'application/json',
                'WWW-Authenticate': 'Basic realm="Mapproj"'
            });
            return res.end(JSON.stringify({ error: 'Missing credentials' }));
        }
        // check for admin
        getUserRole(username, (err, role) => {
            if (err || role !== 'admin') {
                res.writeHead(403, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Forbidden: Admins only' }));
            }
            // grabbing id, username, and role for all users
            connection.query('SELECT id, username, role FROM users', (err, results) => {
                if (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'DB error', details: err.message }));
                }
                res.writeHead(200, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify(results));
            });
        });
        return;
    }
    // checking that the request is aimed at the API endpoint.
    // the regex accepts both "/api/endpoint" and "/api/endpoint/"
    if (!/^\/api\/endpoint\/?$/.test(parsedUrl.pathname)) {
        console.log("Not our API endpoint -> 404");
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end("Endpoint not found");
        return;
    }

    // handles GET requests for listing/fetching pins
    if (req.method === 'GET') {
        const id = parsedUrl.query.id;
        console.log("Handling GET. id =", id);

        //checking that my database can communicate with my CRUD
        if (id) {
            connection.query('SELECT * FROM pins WHERE id = ?', [id], (err, results) => {
                if (err) {
                    console.error("Database error on SELECT by id:", err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Database error' }));
                }
                //checking the existence of the ID, I predict I'll have 
                // to delete bad pins so this seemed important
                if (results.length === 0) {
                    console.log("No record found for id:", id);
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Record not found' }));
                }
                console.log("Returning record:", results[0]);
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(results[0]));
            });
        } else {
            connection.query('SELECT * FROM pins', (err, results) => {
                if (err) {
                    console.error("Database error on SELECT all:", err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Database error' }));
                }
                //this returns the entirety of my userpin table in my mapproj database
                // for rendering the pins on the map when a user first visits the site
                console.log("Returning all records:", results.length, "rows.");
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(results));
            });
        }
        return;
    }

    // my POST method for handling pin creation
    if (req.method === 'POST') {
        console.log("POST request - about to parse form data...");
        const { formidable } = require('formidable');

        // Retrieve logged in user's username from the Authorization header.
        const loggedInUsername = getUsernameFromAuth(req);
        if (!loggedInUsername) {
            res.writeHead(401, { 
              'Content-Type': 'application/json',
              'WWW-Authenticate': 'Basic realm="Mapproj"'
            });
            return res.end(JSON.stringify({ error: 'Authentication required for creating pins' }));
        }

        // creating the formidable instance, the module I'm
        // using to process forms that may include images as well as text
        const form = formidable({
            uploadDir: 'uploads',
            keepExtensions: true,
            multiples: false,
            allowEmptyFiles: true,
            minFileSize: 0
        });

        //debugging stuff
        form.parse(req, async(err, fields, files) => {
            console.log("Form parsed. fields:", fields);
            console.log("files:", files);

            if (err) {
                console.error("Error parsing form data:", err);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                    error: 'Error parsing the form data',
                    details: err.message
                }));
            }

            // pin‑limit: max 6 pins per user per day ——
            const [rows] = await connection
                .promise()
                .query(
                    `SELECT COUNT(*) AS cnt
                    FROM pins
                    WHERE username = ?
                        AND created_at >= CURRENT_DATE()`,
                    [loggedInUsername]
            );

            const MAX_PINS_PER_DAY = 4;
            if (rows[0].cnt >= MAX_PINS_PER_DAY) {
                res.writeHead(429, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({
                    error: `Daily pin limit of ${MAX_PINS_PER_DAY} reached`
                }));
            }

            // formidable insists on intaking data as arrays, but that
            // won't work with my front end which expects json, so I have to 
            // turn them back into strings.
            let nameVal = fields.name;
            if (Array.isArray(nameVal)) {
                nameVal = nameVal[0];
            }

            let descVal = fields.description;
            if (Array.isArray(descVal)) {
                descVal = descVal[0];
            }

            let latVal = fields.lat;
            if (Array.isArray(latVal)) {
                latVal = latVal[0];
            }
            let lngVal = fields.lng;
            if (Array.isArray(lngVal)) {
                lngVal = lngVal[0];
            }
            
            // I don't need to massage my created_at var for formidable
            // since it isnt coming in from the user form
            const created_at = new Date()
            
            // same array deal with my images, I have to turn them from arrays into files
            // grabs the first element if it's an array, I'll need to change this to allow 
            // users to upload multiple photos.
            let imageObj = null;
            if (files.image) {
                imageObj = Array.isArray(files.image) ? files.image[0] : files.image;
            }

            // if the image is valid, this grabs the filepath so it can be served
            let imagePath = '';
            if (imageObj && imageObj.filepath) {
                imagePath = imageObj.filepath;
            }

            // ensuring lat/lng are numeric data types
            latVal = parseFloat(latVal);
            lngVal = parseFloat(lngVal);

            // requiring my pins to have a name from the user here
            if (!nameVal) {
                console.log("Missing 'name' field");
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Missing parameter: name' }));
            }

            const path = require('path');
            //this creates the imagepath that my server will use to 
            // serve images to users
            if (imageObj && imageObj.filepath) {
                const baseName = path.basename(imageObj.filepath);  
                imagePath = '/uploads/' + baseName;
            }
            
            //debugging stuff
            console.log("Inserting into database: name =", nameVal,
                "desc =", descVal,
                "img =", imagePath,
                "lat =", latVal,
                "lng =", lngVal,
                "username =", loggedInUsername,
                "created_at =", created_at
            );

            // inserting a new record into my mariadb database.
            // Note: The pins table should include a column (e.g., username) to track the owner.
            connection.query(
            'INSERT INTO pins (name, description, imageUrl, lat, lng, username, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [nameVal, descVal || "", imagePath, latVal || null, lngVal || null, loggedInUsername, created_at],
            (err, result) => {
                if (err) {
                    console.error("Database error on INSERT:", err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Database error', details: err }));
                }
                console.log("Inserted new record with id:", result.insertId);

                // Create the newPinData object using the inserted record details
                const newPinData = {
                    id: result.insertId,
                    name: nameVal,
                    description: descVal,
                    imageUrl: imagePath,
                    lat: latVal,
                    lng: lngVal,
                    username: loggedInUsername,
                    created_at: created_at
                };

                // NEW: Broadcast the new pin to WebSocket clients.
                global.broadcast.broadcastPinCreate(wss, newPinData);

                // Return the new pin to the client via HTTP response
                res.writeHead(201, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(newPinData));
            }
            );
        });
        return;
    }

    // put method for updating pins
    if (req.method === 'PUT') {
        console.log("Handling PUT request");
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                // parsing name and description from request body
                const data = JSON.parse(body);
                const { id, name, description } = data;
                console.log("PUT data:", data);

                // only requiring id so users can delete name/desc via edit
                if (!id) {
                    console.log("Missing id in PUT data");
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Missing parameter: id' }));
                }

                // grabbing username from auth header
                const loggedInUsername = getUsernameFromAuth(req);
                if (!loggedInUsername) {
                    res.writeHead(401, { 
                      'Content-Type': 'application/json',
                      'WWW-Authenticate': 'Basic realm="Mapproj"'
                    });
                    return res.end(JSON.stringify({ error: 'Authentication required for updating pins' }));
                }

                // grabbing role from database to check if admin
                getUserRole(loggedInUsername, (err, role) => {
                    if (err || !role) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ error: 'Error retrieving user role' }));
                    }
                    // giving admin ability to edit every pin
                    if (role === 'admin') {
                        connection.query(
                            'UPDATE pins SET name = ?, description = ? WHERE id = ?',
                            [name || "", description || "", id],
                            (err, result) => {
                                if (err) {
                                    console.error("Database error on UPDATE (admin):", err);
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    return res.end(JSON.stringify({ error: 'Database error', details: err }));
                                }
                                if (result.affectedRows === 0) {
                                    console.log("No record found to update for id:", id);
                                    res.writeHead(404, { 'Content-Type': 'application/json' });
                                    return res.end(JSON.stringify({ error: 'Record not found' }));
                                }
                                console.log("Admin updated record id:", id, "to name:", name, "and description:", description);
                                
                                // NEW: Broadcast the updated pin data to WebSocket clients.
                                global.broadcast.broadcastPinEdit(wss, { id, name, description });
                                
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                return res.end(JSON.stringify(wss, { id, name, description }));
                            }
                        );
                    } else {
                        // makes sure users can only edit their own pins
                        connection.query(
                            'UPDATE pins SET name = ?, description = ? WHERE id = ? AND username = ?',
                            [name || "", description || "", id, loggedInUsername],
                            (err, result) => {
                                if (err) {
                                    console.error("Database error on UPDATE (author):", err);
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    return res.end(JSON.stringify({ error: 'Database error', details: err }));
                                }
                                // in case pins persist despite id being deleted or lost
                                if (result.affectedRows === 0) {
                                    console.log("No record found to update for id:", id, "or not authorized");
                                    res.writeHead(404, { 'Content-Type': 'application/json' });
                                    return res.end(JSON.stringify({ error: 'Record not found or not authorized' }));
                                }
                                console.log("Updated record id:", id, "to name:", name, "and description:", description);
                                
                                // Broadcast the updated pin data to WebSocket clients.
                                global.broadcast.broadcastPinEdit(wss, { id, name, description });
                                
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                const updatedPinData = { id, name, description };
                                return res.end(JSON.stringify(updatedPinData));
                            }
                        );
                    }
                });
            } catch (e) {
                console.error("Invalid JSON in PUT:", e);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }

    // for deleting pins
    if (req.method === 'DELETE') {
        console.log("Handling DELETE request");
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const { id } = data;
                console.log("DELETE data:", data);

                if (!id) {
                    console.log("Missing id in DELETE data");
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    return res.end(JSON.stringify({ error: 'Missing parameter: id' }));
                }

                // grab logged in user's username from Authorization header.
                const loggedInUsername = getUsernameFromAuth(req);
                if (!loggedInUsername) {
                    res.writeHead(401, { 
                      'Content-Type': 'application/json',
                      'WWW-Authenticate': 'Basic realm="Mapproj"'
                    });
                    return res.end(JSON.stringify({ error: 'Authentication required for deleting pins' }));
                }

                //grabbing role for the user
                getUserRole(loggedInUsername, (err, role) => {
                    if (err || !role) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        return res.end(JSON.stringify({ error: 'Error retrieving user role' }));
                    }
                    if (role === 'admin') {
                        // admin can delete any pin.
                        connection.query(
                            'DELETE FROM pins WHERE id = ?',
                            [id],
                            (err, result) => {
                                if (err) {
                                    console.error("Database error on DELETE (admin):", err);
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    return res.end(JSON.stringify({ error: 'Database error', details: err }));
                                }
                                if (result.affectedRows === 0) {
                                    console.log("No record found to delete for id:", id);
                                    res.writeHead(404, { 'Content-Type': 'application/json' });
                                    return res.end(JSON.stringify({ error: 'Record not found' }));
                                }
                                console.log("Admin deleted record with id:", id);
                                
                                // Broadcast the deletion of the pin to WebSocket clients.
                                global.broadcast.broadcastPinDelete(wss,{ id });
                                
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                return res.end(JSON.stringify({ message: 'Record deleted', id }));
                            }
                        );
                    } else {
                        // users can delete their own pins
                        connection.query(
                            'DELETE FROM pins WHERE id = ? AND username = ?',
                            [id, loggedInUsername],
                            (err, result) => {
                                if (err) {
                                    console.error("Database error on DELETE (author):", err);
                                    res.writeHead(500, { 'Content-Type': 'application/json' });
                                    return res.end(JSON.stringify({ error: 'Database error', details: err }));
                                }
                                // had an error with pins persisting after deletion so added this check
                                if (result.affectedRows === 0) {
                                    console.log("No record found to delete for id:", id, "or not authorized");
                                    res.writeHead(404, { 'Content-Type': 'application/json' });
                                    return res.end(JSON.stringify({ error: 'Record not found or not authorized' }));
                                }
                                console.log("Deleted record with id:", id);
                                
                                // NEW: Broadcast the deletion of the pin to WebSocket clients.
                                global.broadcast.broadcastPinDelete(wss, { id });
                                
                                const pinDeletionData = { message: 'Record Deleted', id };
                                res.writeHead(200, { 'Content-Type': 'application/json' });
                                return res.end(JSON.stringify(pinDeletionData));
                            }
                        );
                    }
                });
            } catch (e) {
                console.error("Invalid JSON in DELETE:", e);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
        return;
    }
    //this happens if the method is unrecognized,
    //got this as an error often before wrapping it in an else-block
    else {
        console.log("Reached fallback for method:", req.method);
        console.log("Method not allowed:", req.method);
        res.writeHead(405, { 'Content-Type': 'text/plain' });
        res.end("Method not allowed");
    }
};
// created a separate file to handle my server startup
module.exports = {
    requestHandler,
    connection
};

// Passenger loads app.js directly rather than running the npm start script.
process.env.NODE_ENV = "production";

const http = require("node:http");
const next = require("next");

const app = next({ dev: false, dir: __dirname });
const handle = app.getRequestHandler();

app.prepare()
  .then(() => {
    const server = http.createServer(async (req, res) => {
      try {
        await handle(req, res);
      } catch (error) {
        console.error("Request failed:", error);
        if (res.headersSent) {
          res.destroy();
          return;
        }
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "Internal server error." }));
      }
    });

    server.on("error", (error) => {
      console.error("Server failed:", error);
      process.exit(1);
    });

    // Passenger intercepts listen() and manages the public connection.
    server.listen(Number(process.env.PORT) || 3100);
  })
  .catch((error) => {
    console.error("Unable to start Merchvision:", error);
    process.exit(1);
  });

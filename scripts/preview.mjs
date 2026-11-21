// Serve the release under a repository subpath, as on GitHub Pages.
import http from "node:http";
import path from "node:path";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
const port = Number(process.env.PORT || 4173),
  root = path.resolve("docs");
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".png": "image/png",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".webmanifest": "application/manifest+json",
};
http
  .createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, "http://localhost").pathname;
      if (!pathname.startsWith("/apogee/")) {
        res.writeHead(404).end();
        return;
      }
      const file = path.resolve(
        root,
        "." +
          decodeURIComponent(pathname.slice(7) || "/") +
          (pathname.endsWith("/") ? "index.html" : ""),
      );
      if (!file.startsWith(root + path.sep) || !(await stat(file)).isFile())
        throw Error();
      res.writeHead(200, {
        "Content-Type": types[path.extname(file)] || "application/octet-stream",
      });
      createReadStream(file).pipe(res);
    } catch {
      res.writeHead(404).end();
    }
  })
  .listen(port, "127.0.0.1");

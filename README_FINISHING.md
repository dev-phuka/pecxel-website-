# pEc-XeL Web — Setup and Management

## What’s implemented
- Homepage (`index.html`)
  - Dynamic Blog preview via `GET /api/posts`
  - Dynamic Donation preview via `GET /api/donations`
  - Proper Donate/Sponsor/Mentor links
- Blog renderer (`post.html`)
  - Loads post by `post.html?slug=...` via `GET /api/posts/:slug`
- Donations page (`donate.html`)
  - Loads donation HTML via `GET /api/donations`
- Admin (`admin.html`)
  - Products, services, and projects: add, edit, publish/draft, and remove
  - Upload product and content images from a phone or computer to Cloudinary
  - Blog posts and donation entries: create, edit, publish/draft, and remove
  - Custom pages: create, edit, choose whether to show in navigation, and remove
  - Site settings: edit brand descriptor, tagline, WhatsApp, email, location, and hours
  - Access protected by the `BLOG_ADMIN_TOKEN` from the local `.env` file

## Backend API (summary)
- `GET /api/catalog/:type`
- `GET /api/pages`
- `GET /api/pages/:slug`
- `GET /api/site-settings`
- `GET /api/posts`
- `GET /api/posts/:slug`
- `GET /api/donations`
- `GET /api/admin/posts`
- `POST /api/admin/posts`
- `PUT /api/admin/posts/:id`
- `DELETE /api/admin/posts/:id`
- `/api/admin/catalog/:type` (GET, POST)
- `/api/admin/catalog/:type/:id` (PUT, DELETE)
- `/api/admin/pages` (GET, POST)
- `/api/admin/pages/:id` (PUT, DELETE)
- `/api/admin/settings` (GET, PUT)

## Image uploads
Product and content images are uploaded directly from the Website Manager to Cloudinary using a short-lived signature created by the server. The Cloudinary API secret stays on the server and must never be put in browser code.

1. Create a Cloudinary account and find the Cloud name, API Key, and API Secret in its dashboard.
2. Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to the Render service's Environment settings. For local development, put them in the ignored `.env` file.
3. Deploy/restart the service, open Website Manager, connect, and choose an image from the phone's photo library or camera. Images must be under 10 MB and use JPG, PNG, WebP, AVIF, or HEIC.
4. Save the record after upload. Its Cloudinary URL is saved with the product/post/project, so it is not lost when Render redeploys.

If the Cloudinary variables are missing, the image upload action reports that uploads are not configured. Existing image URLs and site-bundled image paths can still be entered manually.

## Quick steps to test locally
1. Use Node.js 22.5 or newer (the backend uses Node's built-in SQLite module).
2. Install dependencies from `pecxel-website/`: `npm install`.
3. Copy `.env.example` to `.env`, then replace the example `BLOG_ADMIN_TOKEN` with a private value. The real token is in `.env`; do not share or commit that file.
4. Start the website from `pecxel-website/`: `npm start`.
5. Open `http://localhost:<PORT>/` for the public site or `http://localhost:<PORT>/admin.html` for Website Manager. `<PORT>` is set in `.env` (the current local configuration uses `3002`).
6. Enter `BLOG_ADMIN_TOKEN` from `.env` into the Admin token field and select Connect.

The manager can create, edit, publish, draft, and delete products, services, projects, blog posts, donation entries, and custom pages. It also edits public contact and brand settings. The SQLite database is stored locally in `pecxel-blog.sqlite`; back up that file with the site.

Do not commit `.env` or share the admin token. Set a strong token before deploying the website to a public server.

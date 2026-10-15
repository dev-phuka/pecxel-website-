# TODO — pEc-XeL web finishing

- [ ] Wire dynamic Blog preview on `index.html` using `GET /api/posts`.
- [ ] Improve Donation section on `index.html` to link to `donate.html` and optionally preview first published donation from `GET /api/donations`.
- [ ] Update `pecxel-website/script.js` to fetch and render the dynamic sections without breaking AI assistant modal.
- [ ] Add/adjust minimal CSS in `pecxel-website/style.css` for dynamic containers/loading states.
- [ ] Sanity test: run `node pecxel-website/server.js` and verify:
  - `/` loads homepage
  - blog preview renders
  - `/donate.html` loads donation
  - `/post.html?slug=...` works


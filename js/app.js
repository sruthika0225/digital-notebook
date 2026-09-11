/*
  app.js
  ------
  The entry point. Loaded last (after storage.js, canvas.js,
  images.js, pages.js, handwriting.js) so everything it calls
  already exists. Its only job is to boot the app: make sure the
  saved "current page" is still valid, render it, and default to
  Pen mode.
*/

if (currentPage >= pages.length) currentPage = pages.length - 1;
renderPage(currentPage);
setMode('pen');

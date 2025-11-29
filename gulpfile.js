var gulp = require("gulp");

// Copy all files from src/mails to dist/mails
gulp.task("copy:mails", function () {
  return gulp.src("src/mails/**/*").pipe(gulp.dest("dist/mails"));
});

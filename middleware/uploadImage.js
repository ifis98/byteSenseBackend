var multer = require('multer');
var path = require('path');

var Storage = multer.diskStorage({
  destination: "./Uploads/profilePictures/",
  filename:(req,file,cb)=>{
    cb(null,file.fieldname+"_"+Date.now()+path.extname(file.originalname));
  }
});
var upload = multer({
  storage:Storage
}).single('picture');

module.exports = upload

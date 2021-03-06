const fs = require('fs-extra');
const _ = require('lodash');
const diskspace = require('diskspace');
const mime = require('mime-types');
const path = require('path');
const os = require('os');

const config = require('../config');
const storageFolderPath = config.storageFolder;

// TODO: On Linux this has to be re-worked
const diskSpacelocation = (os.platform() === "win32") ? storageFolderPath.split(path.sep)[0] : "/" ;

console.log(`The files will be stored in: ${storageFolderPath}`);

// Transform bytes to human format
const sizeOf = function (bytes) {
  if (bytes === 0) {
    return "0.00 B";
  }
  const e = Math.floor(Math.log(bytes) / Math.log(1000));
  return (bytes / Math.pow(1000, e)).toFixed(2) + '' + ' KMGTP'.charAt(e) + 'B';
};

// File type icons
function fileTypeIcon(type) {
  if (!type) {
    return 'warning';
  }
  if (type.includes('image') && !type.includes('gif')) {
    return 'image';
  }
  if (type.includes('x-msdos-program')) {
    return 'play_circle_outline';
  }
  if (type.includes('pdf')) {
    return 'picture_as_pdf';
  }
  if (type.includes('text')) {
    return 'text_format';
  }
  if (type.includes('gif')) {
    return 'gif';
  }
  if (type.includes('video')) {
    return 'ondemand_video';
  }
  if (type.includes('zip')) {
    return 'archive';
  }
  return 'warning';
}

//
const _showFiles = (res) => {
  return new Promise((resolve, reject) => {
    let files = [];

    try {
      if (!fs.existsSync(storageFolderPath)) {
        fs.mkdirSync(storageFolderPath);
      }

      fs.readdirSync(storageFolderPath).forEach(file => {
        files.push(file);
      });
      resolve(files);
    } catch (err) {
      reject(err);
    }
  }).then(files => {
    let innerPromises = [];
    // if(files == [])
    //   return 0;
    for (let i = 0; i < files.length; i++) {
      innerPromises.push(new Promise((resolve, reject) => {
        fs.stat(storageFolderPath + files[i], (err, stats) => {
          if (err) {
            reject(err);
            return;
          }

          resolve({
            'name': files[i],
            'url': '/uploaded_files/' + files[i],
            'size': sizeOf(stats['size']),
            'intSize': stats['size'],
            'created': stats['birthtime'],
            'icon': fileTypeIcon(mime.lookup(files[i]))
          });
        });
      }));
    }
    return Promise.all(innerPromises);

  }).then(files => {

    return new Promise((resolve, reject) => {
      const filesAndFreeSpace = {};
      filesAndFreeSpace.files = files;
      filesAndFreeSpace.chartsInfo = {};

      const itemTypes = ['pdf', 'image', 'text', 'gif', 'video', 'exe', 'zip', 'other'];

      for (let x of itemTypes) {
        filesAndFreeSpace.chartsInfo[x + 'Count'] = 0;
        filesAndFreeSpace.chartsInfo[x + 'Size'] = 0;
        filesAndFreeSpace.chartsInfo[x + 'IntSize'] = 0;
      }

      filesAndFreeSpace.files.forEach(function typeSizeCalc(file) {
        if (file.icon === 'picture_as_pdf') {
          filesAndFreeSpace.chartsInfo.pdfIntSize += file.intSize;
          filesAndFreeSpace.chartsInfo.pdfCount += 1;
          filesAndFreeSpace.chartsInfo.pdfSize = sizeOf(filesAndFreeSpace.chartsInfo.pdfIntSize)
        }
        else if (file.icon === 'image') {
          filesAndFreeSpace.chartsInfo.imageIntSize += file.intSize;
          filesAndFreeSpace.chartsInfo.imageCount += 1;
          filesAndFreeSpace.chartsInfo.imageSize = sizeOf(filesAndFreeSpace.chartsInfo.imageIntSize)
        }
        else if (file.icon === 'text_format') {
          filesAndFreeSpace.chartsInfo.textIntSize += file.intSize;
          filesAndFreeSpace.chartsInfo.textCount += 1;
          filesAndFreeSpace.chartsInfo.textSize = sizeOf(filesAndFreeSpace.chartsInfo.textIntSize)
        }
        else if (file.icon === 'gif') {
          filesAndFreeSpace.chartsInfo.gifIntSize += file.intSize;
          filesAndFreeSpace.chartsInfo.gifCount += 1;
          filesAndFreeSpace.chartsInfo.gifSize = sizeOf(filesAndFreeSpace.chartsInfo.gifIntSize)
        }
        else if (file.icon === 'ondemand_video') {
          filesAndFreeSpace.chartsInfo.videoIntSize += file.intSize;
          filesAndFreeSpace.chartsInfo.videoCount += 1;
          filesAndFreeSpace.chartsInfo.videoSize = sizeOf(filesAndFreeSpace.chartsInfo.videoIntSize)
        }
        else if (file.icon === 'archive') {
          filesAndFreeSpace.chartsInfo.zipIntSize += file.intSize;
          filesAndFreeSpace.chartsInfo.zipCount += 1;
          filesAndFreeSpace.chartsInfo.zipSize = sizeOf(filesAndFreeSpace.chartsInfo.zipIntSize)
        }
        else if (file.icon === 'play_circle_outline') {
          filesAndFreeSpace.chartsInfo.exeIntSize += file.intSize;
          filesAndFreeSpace.chartsInfo.exeCount += 1;
          filesAndFreeSpace.chartsInfo.exeSize = sizeOf(filesAndFreeSpace.chartsInfo.exeIntSize)
        }
        else if (file.icon === 'warning') {
          filesAndFreeSpace.chartsInfo.otherIntSize += file.intSize;
          filesAndFreeSpace.chartsInfo.otherCount += 1;
          filesAndFreeSpace.chartsInfo.otherSize = sizeOf(filesAndFreeSpace.chartsInfo.otherIntSize)
        }
      });


      diskspace.check(diskSpacelocation, function (err, result) {
        if (err) {
          reject(err);
        } else {
          filesAndFreeSpace.freeSpace = sizeOf(result.free);
          filesAndFreeSpace.usedSpace = sizeOf(result.used);
          filesAndFreeSpace.totalSpace = sizeOf(result.total);
          filesAndFreeSpace.free = result.free;
          filesAndFreeSpace.used = result.used;
          resolve(filesAndFreeSpace)
        }
      });
    });
  }).then((filesAndFreeSpace) => {
    res.render('index', {
      title: 'Upload', files: _.orderBy(filesAndFreeSpace.files, ['created'], ['desc']),
      freeSpace: filesAndFreeSpace.freeSpace, free: filesAndFreeSpace.free,
      usedSpace: filesAndFreeSpace.usedSpace, used: filesAndFreeSpace.used,
      totalSpace: filesAndFreeSpace.totalSpace,
      sizeLocation: diskSpacelocation,
      json: filesAndFreeSpace.chartsInfo
    });

  }).catch((err) => {
    res.render('index', {title: 'Error occurred'});
    console.error(err)
  })
};


module.exports = _showFiles;
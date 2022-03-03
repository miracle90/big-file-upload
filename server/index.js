const http = require("http");
const path = require("path");
const fse = require("fs-extra");
const mutilparty = require("multiparty");

const TARGET_DIR = path.resolve(__dirname, "..", "target");

const server = http.createServer();

/**
 * 解析请求体，获取参数
 */
function resolvePost(req) {
  return new Promise((resolve) => {
    let chunk = "";
    req.on("data", (data) => {
      chunk += data;
    });
    req.on("end", () => {
      resolve(JSON.parse(chunk));
    });
  });
}

function pipeStream(path, writeStream) {
  return new Promise((resolve) => {
    // 创建可读流
    console.log("创建可读流", path);
    const readStream = fse.createReadStream(path);
    // 文件读取完毕触发
    readStream.on("end", () => {
      // 删除文件或符号链接，不适用于目录
      fse.unlinkSync(path);
      resolve();
    });
    readStream.pipe(writeStream);
  });
}

/**
 * 合并切片
 * @param {*} filePath 合并之后新生成文件的绝对路径
 * @param {*} filename
 */
async function mergeFileChunk(filePath, filename, size) {
  // 保存切片的目录路径
  const chunkDir = path.resolve(TARGET_DIR, filename);
  // 临时文件文件名的集合
  const chunkPaths = await fse.readdir(chunkDir);
  // 根据索引排序
  chunkPaths.sort((a, b) => a.split("-")[1] - b.split("-")[1]);
  await Promise.all(
    chunkPaths.map((chunkPath, index) => {
      // 临时文件的绝对路径
      const tempChunkPath = path.resolve(chunkDir, chunkPath);
      return pipeStream(
        tempChunkPath,
        fse.createWriteStream(filePath, {
          start: index * size,
          end: (index + 1) * size,
        })
      );
    })
  );
  console.log("++++准备清空˝");
  // 合并好切片之后，删除保存切片的文件夹
  fse.rmdirSync(chunkDir);
}

server.on("request", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "*");
  // 处理OPTIONS预检请求
  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.end();
    return;
  }
  // 合并切片
  if (req.url === "/merge") {
    console.log("请求来了", req.url);
    // 获取请求体的参数
    const data = await resolvePost(req);
    const { filename, size } = data;
    // 合并之后的文件的路径，文件和文件夹名称相同会出错
    const filePath = path.resolve(TARGET_DIR, `new-${filename}`);
    await mergeFileChunk(filePath, filename, size);
    res.end(
      JSON.stringify({
        code: 0,
        message: "file merged success",
      })
    );
    ``;
    return;
  }
  /**
   * 保存临时文件
   */
  const mp = new mutilparty.Form();
  mp.parse(req, async (err, fields, files) => {
    if (err) {
      return;
    }
    const [chunk] = files.chunk;
    const [hash] = fields.hash;
    const [filename] = fields.filename;
    // 设置保存临时文件的目录为文件名
    const chunkDir = path.resolve(TARGET_DIR, filename);
    // 如果没有文件夹目录，创建一个
    if (!fse.existsSync(chunkDir)) {
      await fse.mkdirs(chunkDir);
    }
    // chunk.path 上传的临时文件的临时目录
    await fse.move(chunk.path, path.resolve(chunkDir, hash));
    res.end("received file chunk");
  });
});

// const rs = fse.createReadStream(
//   "/Users/liyayun/project/big-file-upload/target/2021.docx/2021.docx-0"
// );
// rs.on("open", () => {
//   console.log("文件一打开");
// });
// rs.on("data", (data) => {
//   console.log("rs data", data);
// });
// rs.on("end", () => {
//   console.log("------------");
// });

server.listen(3000, () => {
  console.log("服务已运行");
});

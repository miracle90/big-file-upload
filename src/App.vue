<template>
  <div id="app">
    <input type="file" @change="handleFileChange" />
    <el-button @click="handleUpload">上传</el-button>
  </div>
</template>

<script>
const LIMIT_SIZE = 0.5 * 1024 * 1024; // 0.5Mb

export default {
  name: "App",
  data() {
    return {
      file: null,
    };
  },
  methods: {
    createProgressHandler(item) {
      return (e) => {
        item.percentage = parseInt(String((e.loaded / e.total) * 100));
      };
    },
    handleFileChunks() {
      const chunks = [];
      let current = 0;
      while (current < this.file.size) {
        chunks.push(this.file.slice(current, current + LIMIT_SIZE));
        current += LIMIT_SIZE;
      }
      this.file.slice();
      return chunks;
    },
    /**
     * 分片标记
     * 添加hash
     */
    handleMarkChunks(chunks) {
      const { name } = this.file;
      chunks = chunks.map((chunk, index) => {
        return {
          chunk,
          index,
          hash: `${name}-${index}`,
          percentage: 0,
        };
      });
      return chunks;
    },
    /**
     * 上传
     * 使用 FormData
     * Promise.all
     */
    async uploadChunks(chunks) {
      const requestList = chunks
        .map(({ chunk, hash }, index) => {
          const formData = new FormData();
          formData.append("chunk", chunk);
          formData.append("hash", hash);
          formData.append("filename", this.file.name);
          return { formData, index };
        })
        .map(({ formData, index }) => {
          return this.request({
            url: "http://192.168.1.103:3000/",
            data: formData,
            onProgress: this.createProgressHandler(chunks[index]),
          });
        });
      await Promise.all(requestList);
    },
    /**
     * 通知服务端合并切片
     */
    async mergeChunks() {
      console.log(this.file.name);
      await this.request({
        url: "http://192.168.1.103:3000/merge",
        headers: {
          "content-type": "application/json",
        },
        data: JSON.stringify({
          filename: this.file.name,
          size: LIMIT_SIZE,
        }),
      });
    },
    /**
     * 封装请求接口
     * 处理成Promise
     */
    request({
      url,
      method = "POST",
      data,
      headers = {},
      onProgress = (e) => e,
      requestList = [],
    }) {
      console.log("+++ ", data);
      return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();
        // 增加进度条
        xhr.upload.onprogress = onProgress;
        xhr.open(method, url);
        Object.keys(headers).forEach((key) => {
          xhr.setRequestHeader(key, headers[key]);
        });
        xhr.send(data);
        xhr.onload = (e) => {
          resolve(e.target.response);
        };
      });
    },
    handleFileChange(e) {
      const [file] = e.target.files;
      this.file = file || null;
    },
    /**
     * 上传
     * 1、分片
     * 2、标记hash
     * 3、并发上传
     */
    async handleUpload() {
      if (!this.file) {
        this.$message("请选择要上传的文件");
        return;
      }
      // 分片
      const chunks = this.handleFileChunks();
      const markedChunks = this.handleMarkChunks(chunks);
      // 上传切片
      await this.uploadChunks(markedChunks);
      // 通知服务端合并切片
      await this.mergeChunks();
    },
  },
};
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>

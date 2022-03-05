# 大文件的分片上传、断点续传及其相关拓展

### 大文件分片上传核心方法


* 前端获取File，使用slice方法进行切片
* 使用 FormData 格式进行上传
* 服务端接口接受到数据，通过 multiparty 库对数据进行处理
* 区分 files 和 fields，通过 fse.move 将上传的文件移动到目标路径下
* 客户端使用 Promise.all 方法，当监听到所有切片已上传完，调用 merge 接口，通知服务端进行切片的合并
* 使用 Stream 对切片边读边写，设置可写流的 start
* Promise.all判断所有切片是否写入完毕

### 进度条

* 使用浏览器 XMLHttpRequest 的 onprogress 的方法对进度进行监听

```js
// 作为request的入参
const xhr = new XMLHttpRequest();
xhr.upload.onprogress = onProgress;
// 回调方法
onProgress: this.createProgressHandler(this.data[index])
// 接受回调，通过 e.loaded 和 e.total 获取进度
createProgressHandler(item) {
  return (e) => {
    item.percentage = parseInt(String((e.loaded / e.total) * 100));
  };
},
```

### 断点续传核心方法

#### 方法一：通过xhr的 abort 方法，主动放弃当前请求

```js
this.requestList.forEach((xhr) => xhr?.abort());
```

### 扩展


1. 计算hash耗时的问题，不仅可以通过web-workder，还可以参考React的Fiber架构，通过requestIdleCallback来利用浏览器的空闲时间计算，也不会卡死主线程
1. 大文件由于切片过多，过多的HTTP链接过去，也会把浏览器打挂， 我们可以通过控制异步请求的并发数来解决，这也是头条的一个面试题
1. 并发上传中，报错如何重试，比如每个切片我们允许重试两次，三次再终止
1. 由于文件大小不一，我们每个切片的大小设置成固定的也有点略显笨拙，我们可以参考TCP协议的慢启动策略， 设置一个初始大小，根据上传任务完成的时候，来动态调整下一个切片的大小， 确保文件切片的大小和当前网速匹配
1. 文件碎片清理

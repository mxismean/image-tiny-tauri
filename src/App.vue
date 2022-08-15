<template>
  <div class="main">
    <div class="title" data-tauri-drag-region>
      <div class="title-left">
        <p @click="handleClose"></p>
        <p @click="handleMin"></p>
        <p @click="handleMax"></p>
      </div>
    </div>
    <!-- 头部 -->
    <div class="header">
      <div class="cell-name">名称</div>
      <div class="cell-common">状态</div>
      <div class="cell-common">原始大小</div>
      <div class="cell-common">压缩后大小</div>
      <div class="cell-common">压缩率</div>
      <div class="cell-down">操作</div>
    </div>
    <!-- 内容区 -->
    <div
      class="middle-con"
      @dragenter="dragenterEvent"
      @dragover="dragoverEvent"
      @dragleave="dragleaveEvent"
      @drop="dropEvent"
    >
      <div v-if="datas.imgList.length === 0" class="drop-tip">拖 放 图 片</div>
      <div v-else class="image-items">
        <ul>
          <li class="image-list" v-for="(item, index) in datas.imgList" :key="index">
            <div class="cell-name">{{ item.name || '--' }}</div>
            <div class="cell-common" :class="{ sucess: item.status === '完成' }">
              {{ item.status || '--' }}
            </div>
            <div class="cell-common">{{ item.before || '--' }}</div>
            <div class="cell-common">{{ item.after || '--' }}</div>
            <div class="cell-common">{{ item.rate || '--' }}</div>
            <div class="cell-down">
              <p @click="handleSaveFile(item)">
                {{ item.status === '完成' ? '保存' : '--' }}
              </p>
            </div>
          </li>
        </ul>
      </div>
    </div>
    <!-- 底部 -->
    <div class="footer">
      <div class="action-left">
        <div v-if="datas.tip" class="action-btn-add-tip">🔔 {{ datas.tip || '' }}</div>
      </div>
      <div class="action-right">
        <div class="action-quality">
          <p>质量</p>
          <select
            class="action-quality-sel"
            v-model="datas.quality"
            @change="getSelected"
            name="quality"
          >
            <option selected :value="80">80</option>
            <option :value="70">70</option>
            <option :value="60">60</option>
            <option :value="50">50</option>
            <option :value="40">40</option>
            <option :value="30">30</option>
            <option :value="20">20</option>
            <option :value="10">10</option>
          </select>
          <p>%</p>
        </div>
        <div class="action-btn" @click="handleWindowTop">{{ datas.winTop }}</div>
        <div class="action-btn" @click="handleClearList">清除列表</div>
        <div class="action-btn" @click="handleDownloadAll">一键打包</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import JSZip from 'jszip';
import imageTiny from '@mxsir/image-tiny';
import { reactive, nextTick } from 'vue';
// import { listen } from '@tauri-apps/api/event';
import { writeBinaryFile } from '@tauri-apps/api/fs';
import { path, dialog, window } from '@tauri-apps/api';
import { appWindow } from '@tauri-apps/api/window';

type Datas = {
  imgList: Record<string, any>[];
  tip: string;
  winTop: string;
  quality: number;
};

const datas = reactive<Datas>({
  imgList: [],
  tip: '拖放图片文件到上方区域',
  winTop: '窗口置顶',
  quality: 80,
});

function handleClose() {
  appWindow.close();
}

function handleMin() {
  appWindow.minimize();
}
function handleMax() {
  // appWindow.maximize();
}

// 设置压缩质量 20-80 %
function getSelected(e: Event) {
  const val = (e.target as HTMLSelectElement).value;
  datas.quality = Number(val) || 80;
}

// 窗口置顶
function handleWindowTop() {
  let curWin = window.getCurrent();
  if (datas.winTop === '窗口置顶') {
    curWin.setAlwaysOnTop(true);
    datas.winTop = '取消置顶';
  } else {
    curWin.setAlwaysOnTop(false);
    datas.winTop = '窗口置顶';
  }
}

// 一键打包保存
async function handleDownloadAll() {
  const len = datas.imgList.length;
  if (len === 0) {
    return;
  }
  datas.tip = 'zip 保存中...';
  const zip = new JSZip();
  for (let i = 0; i < len; i++) {
    zip.file(datas.imgList[i].name, datas.imgList[i].data);
  }
  const date = new Date();
  const mon = (date.getMonth() + 1 < 10 ? '0' + (date.getMonth() + 1) : date.getMonth() + 1) + '_';
  const day = date.getDate() + '_';
  const hour = date.getHours() + '_';
  const min = date.getMinutes();

  const basePath = await path.downloadDir();
  let selPath = await dialog.save({
    defaultPath: basePath,
  });
  selPath = selPath.replace(/Untitled$/, '');

  zip.generateAsync({ type: 'blob' }).then((content) => {
    let file = new FileReader();
    file.readAsArrayBuffer(content);
    file.onload = function (e) {
      let fileU8A = new Uint8Array(e.target!.result as ArrayBufferLike);
      writeBinaryFile({ contents: fileU8A, path: `${selPath}IMG_${mon + day + hour + min}.zip` });
      datas.tip = 'zip 保存成功';
    };
  });
}

// 保存单个图片
async function handleSaveFile(file: Record<string, any>) {
  datas.tip = '图片保存中...';
  const basePath = await path.downloadDir();
  let selPath = await dialog.save({
    defaultPath: basePath,
  });
  selPath = selPath.replace(/Untitled$/, '');

  const reader = new FileReader();

  reader.readAsArrayBuffer(file.data);
  reader.onload = function (e) {
    let fileU8A = new Uint8Array(e.target!.result as ArrayBufferLike);
    writeBinaryFile({ contents: fileU8A, path: `${selPath}${file.data.name}` });
    datas.tip = '图片保存成功';
  };
}

// 清除上传列表
function handleClearList() {
  datas.imgList = [];
  datas.tip = '拖放图片文件到上方区域';
  datas.quality = 80;
}

// 格式化文件尺寸
function getSizeTrans(fs: number): string {
  if (fs < 1024) {
    return String(fs);
  } else if (fs < 1024 * 1024) {
    return parseInt(String((fs * 10) / 1024)) / 10 + 'K';
  } else if (fs < 1024 * 1024 * 1024) {
    return parseInt(String((fs * 10) / 1024 / 1024)) / 10 + 'M';
  } else {
    return parseInt(String((fs * 10) / 1024 / 1024 / 1024)) / 10 + 'G';
  }
}

// 预处理上传的图片文件
async function displayChsFile(files: FileList) {
  let liNum = datas.imgList.length;
  const imgFiles: File[] = [];
  const showImgs: Record<string, any>[] = [];
  for (let i = 0; i < files.length; i++) {
    const file = files.item(i);
    if (file!.type.includes('image')) {
      imgFiles.push(file as File);
      const showFile = {
        name: file!.name,
        before: getSizeTrans(file!.size),
        data: null,
        status: '压缩中...',
        after: null,
        rate: null,
        url: null,
      };
      showImgs.push(showFile);
    }
  }

  datas.imgList = [...datas.imgList, ...showImgs];

  await nextTick();

  setTimeout(() => {
    imgFiles.forEach((file) => {
      uploadFile(file, liNum);
      liNum++;
    });
  }, 500);
}

// 图片文件压缩处理
async function uploadFile(file: File, ufid: number) {
  let tinyFile = await imageTiny(file, datas.quality);
  const rate = ((((file.size - tinyFile.size) * 100) / file.size) | 0) + '%';
  const imgInfo = {
    name: file.name,
    before: getSizeTrans(file.size),
    data: tinyFile,
    status: '完成',
    after: getSizeTrans(tinyFile.size),
    rate: rate,
    url: null,
  };
  datas.imgList[ufid] = imgInfo;
  await nextTick();
}

function dragenterEvent(event: Event) {
  event.stopPropagation();
  event.preventDefault();
}
function dragoverEvent(event: Event) {
  event.stopPropagation();
  event.preventDefault();
}
function dragleaveEvent(event: Event) {
  event.stopPropagation();
  event.preventDefault();
}
function dropEvent(event: DragEvent) {
  event.stopPropagation();
  event.preventDefault();
  const files = event.dataTransfer!.files;
  displayChsFile(files);
}
</script>

<style>
@import url('./assets/css/reset.css');

#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  /* -webkit-overflow-scrolling: auto; */
  width: 100%;
  height: 100%;
  padding: 0 !important;
  margin: 0 !important;
  border-radius: 8px;
  overflow: hidden;
}

.sucess {
  color: #3fb950 !important;
}

@keyframes loadding {
  0% {
    opacity: 0.1;
    transform: scale(1.02);
    filter: blur(10px);
  }
  80% {
    opacity: 1;
  }
  100% {
    transform: scale(1);
  }
}

.main {
  /* width: 600px;
  height: 390px; */
  width: 100%;
  height: 100%;
  font-size: 12px;
  display: flex;
  flex-flow: column;
  overflow: hidden;
  -webkit-overflow-scrolling: auto;
  animation: loadding 600ms ease-in;
}

.title {
  width: 100%;
  height: 20px;
  background: rgba(34, 41, 50, 0.9);
  display: flex;
  align-items: center;
  padding: 0 4px;
}

.title-left {
  width: 60px;
  height: 12px;
  display: flex;
}

.title-left > p {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  text-align: center;
  line-height: 15px;
  margin: 0 4px;
  color: #fff;
  font-weight: bold;
  font-size: 14px;
  background-size: 50%;
  background-position: center;
  background-repeat: no-repeat;
}

.title-left > p:first-child {
  background-color: #ff5f57;
}

.title-left > p:nth-child(2) {
  background-color: #febc2e;
}

.title-left > p:last-child {
  /* background-color: #28c840; */
  background-color: #494c4e;
}

.title-left:hover > p:first-child {
  background-image: url('./assets/image/btn-close.png');
}

.title-left:hover > p:nth-child(2) {
  background-image: url('./assets/image/btn-min.png');
}

/* .title-left:hover > p:last-child {
  background-image: url('./assets/image/btn-max.png');
} */

.footer {
  width: 100%;
  height: 35px;
  padding: 0;
  background: rgba(62, 75, 90, 0.8);
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 0 14px;
}

.action-left {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
}
.sel-image-btn {
  width: 100px;
  height: 30px;
  position: relative;
}
.action-right {
  flex: 1;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.action-quality {
  display: flex;
  width: 80px;
  height: 24px;
  align-items: center;
  justify-content: center;
  color: #fff;
}
.action-quality-sel {
  width: 24px;
  height: 16px;
  margin: 0 5px;
  line-height: 14px;
  color: #fff;
  border: 0.5px solid #fff;
  text-align: center;
  padding-left: 4px;
}

.action-btn {
  cursor: pointer;
  border: 0.5px solid #fff;
  color: #fff;
  display: block;
  width: 50px;
  height: 24px;
  border-radius: 12px;
  text-align: center;
  line-height: 22px;
  margin: 0 6px;
  position: relative;
  font-size: 10px;
}
.action-btn:hover {
  color: #80b9ea;
  border: 1px solid #80b9ea;
}

.action-btn-add {
  cursor: pointer;
  width: 40px;
  height: 24px;
  line-height: 22px;
  border-radius: 6px;
  text-align: center;
}
.action-btn-add-tip {
  color: #fff;
  padding: 0 10px;
}

.action-btn-sel {
  cursor: pointer;
  width: 40px;
  height: 24px;
  border-radius: 6px;
  border: 1px solid #fff;
  color: #fff;
  font-size: 24px;
  position: absolute;
  z-index: 1;
}

.action-btn-ipt {
  cursor: pointer;
  display: block;
  width: 40px;
  height: 24px;
  border-radius: 6px;
  position: absolute;
  z-index: 2;
}

.opacity {
  opacity: 0;
  cursor: pointer;
  z-index: 4;
  font-size: 0;
  margin: 0;
  padding: 0;
}

.middle-con {
  width: 100%;
  flex: 1;
  overflow-y: scroll;
  background: rgba(88, 106, 128, 0.8);
  padding: 4px 8px;
  scrollbar-color: transparent transparent;
  scrollbar-width: none;
}
.middle-con::-webkit-scrollbar {
  width: 0 !important;
}

.drop-tip {
  width: 100%;
  height: 100%;
  line-height: 290px;
  text-align: center;
  color: #b5bbc0;
  font-size: 60px;
  filter: blur(3px);
}

.image-items {
  text-align: left;
  padding: 0;
  overflow: hidden;
}
.header {
  background: rgba(62, 75, 90, 0.8);
  color: #fff;
  padding: 10px;
  width: 100%;
  height: 30px;
  font-size: 14px;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: space-between;
  /* -webkit-app-region: drap; */
}

.image-list {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px;
  width: 100%;
  height: 30px;
  background: rgba(246, 248, 250, 1);
  color: #000000;
  font-size: 12px;
  margin: 2px 0;
  border-radius: 4px;
}
.image-items li:nth-child(even) {
  background: rgba(252, 252, 250, 1);
}

.cell-name {
  float: left;
  width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
}
.cell-common {
  float: left;
  width: 80px;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cell-down {
  float: left;
  width: 60px;
  text-align: center;
}
.cell-down p {
  cursor: pointer;
  text-decoration: none;
  color: #5da6e4;
  font-size: 12px;
}
</style>

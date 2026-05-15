/**
 * One-shot importer (DATA INLINED).
 *
 *   1. Open the extension's new tab page.
 *   2. Right-click → Inspect → Console.
 *   3. Copy this WHOLE file, paste in console, press Enter.
 *   4. Read the summary; refresh the page to see the pins.
 */

const INFINITY_DATA = [
  [
    {
      name: '书签',
      target: 'infinity://bookmarks',
      type: 'app',
    },
    {
      name: '历史记录',
      target: 'infinity://history',
      type: 'app',
    },
    {
      target: 'https://nga.178.com/thread.php?fid=538',
      name: 'NGA玩家社区',
      type: 'web',
    },
    {
      name: '追剧',
      children: [
        { name: '哔哩哔哩', target: 'https://www.bilibili.com/', type: 'web' },
        { target: 'https://v.hi.sy/', name: '解析视频链接 下载', type: 'web' },
        {
          target: 'https://ymck.me/',
          name: '影猫の仓库 | 最好的电影网站目录-免费电影网站列表！观影第一站！',
          type: 'web',
        },
        { name: '电影天堂', target: 'http://www.dy2018.com', type: 'web' },
        {
          target: 'https://www.555kan.net/',
          name: '555电影网-555dy-影视大全-韩国电影免费观看-555dy永久地址发布页，收藏我回家不迷路！',
          type: 'web',
        },
        {
          target: 'https://www.cupfox.app/',
          name: '茶杯狐 Cupfox - 努力让找电影变得简单',
          type: 'web',
        },
        {
          target: 'https://www.dm857.com/',
          name: '樱花动漫_专注动漫的网站_在线观看全集动漫',
          type: 'web',
        },
        {
          target: 'https://arlnigdm.com/',
          name: '宫下动漫-一个遗落的二次元世界',
          type: 'web',
        },
        {
          target: 'https://www.ymck.vip/',
          name: '影猫の仓库-地址发布页，收藏我回家不迷路！',
          type: 'web',
        },
        { target: 'https://gxdm01.org/', name: '宫下动漫', type: 'web' },
        {
          target: 'https://silisili-link.github.io',
          name: '嘶哩嘶哩-永久网址发布页',
          type: 'web',
        },
      ],
    },
    {
      name: 'Search Engines',
      children: [
        { name: '百度翻译', target: 'http://fanyi.baidu.com/', type: 'web' },
        {
          name: 'Google 翻译',
          target: 'https://translate.google.com.hk/?hl=zh-CN&tab=wT',
          type: 'web',
        },
        {
          name: '百度',
          target: 'https://www.baidu.com/?tn=44004473_48_oem_dg&ie=utf-8',
          type: 'web',
        },
        {
          name: '百度网盘',
          target: 'http://pan.baidu.com/disk/home#from=share_pan_logo',
          type: 'web',
        },
        { target: 'https://www.coze.com/', name: 'Coze', type: 'web' },
      ],
    },
    {
      name: 'Web Source',
      children: [
        { name: '阿里图标库', target: 'http://www.iconfont.cn/', type: 'web' },
        { name: 'loading.io ', target: 'https://loading.io/', type: 'web' },
        {
          name: 'MDN',
          target:
            'https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Array',
          type: 'web',
        },
        {
          name: '渐变色模板',
          target: 'https://uigradients.com/#Cherryblossoms',
          type: 'web',
        },
        { name: 'jQuery之家', target: 'http://www.htmleaf.com/', type: 'web' },
        { name: '17素材网', target: 'http://www.17sucai.com/', type: 'web' },
        { name: '100font', target: 'https://www.100font.com/', type: 'web' },
        { target: 'https://htmlrev.com/', name: '前端模板', type: 'web' },
      ],
    },
    {
      name: 'Web Frame',
      children: [
        {
          name: 'Apache ECharts (incubating)',
          target: 'https://echarts.apache.org/zh/index.html',
          type: 'web',
        },
        {
          name: 'makeapie echarts图表可视化案例',
          target: 'https://www.makeapie.cn/echarts',
          type: 'web',
        },
        { name: 'DataV', target: 'http://datav.jiaminghi.com/', type: 'web' },
        {
          name: 'uniapp',
          target: 'https://uniapp.dcloud.io/collocation/pages',
          type: 'web',
        },
        { name: 'uView', target: 'https://uviewui.com/', type: 'web' },
        {
          name: 'Vant - Mobile UI Components built on Vue',
          target: 'https://vant-contrib.gitee.io/vant/#/zh-CN/',
          type: 'web',
        },
        {
          name: "Element - The world's most popular Vue UI framework",
          target: 'https://element.eleme.cn/#/zh-CN/component/installation',
          type: 'web',
        },
        { name: 'Moment.js 中文网', target: 'http://momentjs.cn/', type: 'web' },
        { name: 'Lodash.js', target: 'https://www.lodashjs.com/', type: 'web' },
        {
          name: '树    vue树选择插件',
          target: 'https://www.vue-treeselect.cn/',
          type: 'web',
        },
        {
          name: 'Ant Design Vue',
          target: 'https://www.antdv.com/docs/vue/introduce-cn/',
          type: 'web',
        },
        {
          name: 'Ant Design Mobile - 移动端设计规范',
          target: 'http://antd-mobile.gitee.io/index-cn',
          type: 'web',
        },
        {
          target: 'https://jbaysolutions.github.io/vue-grid-layout/zh/guide/',
          name: 'Vue Grid Layout -️ 适用Vue.js的栅格布局系统',
          type: 'web',
        },
        {
          target: 'http://topology.le5le.com/',
          name: '乐吾乐Topology - 基于开源的免费可视化绘图工具',
          type: 'web',
        },
        {
          target: 'https://docs.guyixi.cn/vue-amap/#/zh-cn/introduction/install',
          name: '@vuemap/vue-amap',
          type: 'web',
        },
        {
          target: 'https://www.isqqw.com/',
          name: 'EChartsDemo集',
          type: 'web',
        },
        { target: 'https://navnav.co/', name: 'NavNav+', type: 'web' },
        {
          target: 'https://element-plus.org/zh-CN/component/overview.html',
          name: 'A Vue 3 UI Framework | Element Plu',
          type: 'web',
        },
        {
          target: 'https://www.makeapie.cn/doc/echarts/zh/option.html',
          name: 'makeapie - ECharts文档 - echarts社区',
          type: 'web',
        },
        {
          target: 'https://www.makeapie.cn/examples/zh/explore.html',
          name: 'makeapie - ECharts案例 - echarts社区案例',
          type: 'web',
        },
        {
          target: 'https://uiverse.io/',
          name: 'Explore 3000+ Free UI Elements: CSS & Tailwind',
          type: 'web',
        },
        {
          target: 'https://www.vueusejs.com/',
          name: 'VueUse中文文档',
          type: 'web',
        },
        { target: 'https://astro.build/themes/', name: 'Astro', type: 'web' },
        {
          target: 'https://ant-design.antgroup.com/components/overview-cn/',
          name: "Ant Design - The world's second most popular React UI framework",
          type: 'web',
        },
        {
          target: 'https://www.naiveui.com/zh-CN/os-theme/components/button',
          name: 'Naive UI',
          type: 'web',
        },
        {
          target: 'https://www.wangeditor.com/',
          name: 'wangEditor',
          type: 'web',
        },
        {
          target:
            'https://bootstrap-vue-next.github.io/bootstrap-vue-next/docs/components/navbar.html',
          name: 'Navbar | BootstrapVueNext',
          type: 'web',
        },
        {
          target: 'https://vue-draggable-plus.pages.dev/',
          name: 'VueDraggablePlus | 支持 Vue2 和 Vue3 的拖拽组件',
          type: 'web',
        },
        {
          target: 'https://datav-vue3.netlify.app/Other/Charts/Charts.html',
          name: 'DataV - Vue3',
          type: 'web',
        },
      ],
    },
    {
      name: 'tool',
      children: [
        { name: '稿定设计', target: 'https://koutu.gaoding.com/', type: 'web' },
        {
          name: '御魂Hub',
          target: 'https://yuhunhub.tql8.com/#/yuhun/calculator',
          type: 'web',
        },
        {
          name: '蓝奏云',
          target: 'https://up.woozooo.com/mydisk.php',
          type: 'web',
        },
        {
          name: 'Chrome 扩展商店',
          target: 'https://chrome.google.com/webstore/category/extensions',
          type: 'web',
        },
        { name: '扩展迷', target: 'https://extfans.com/', type: 'web' },
        { name: '吾爱破解论坛', target: 'http://www.52pojie.cn/', type: 'web' },
        { name: '蓝奏云 2', target: 'https://www.lanzou.com/u', type: 'web' },
        { name: 'CODELF', target: 'https://unbug.github.io/codelf/', type: 'web' },
        { target: 'https://www.pngtosvg.com/', name: 'pngtosvg', type: 'web' },
        { target: 'https://www.0to255.com/', name: '颜色色系', type: 'web' },
        { target: 'https://coolors.co/', name: '配色', type: 'web' },
        {
          target: 'https://www.67tool.com/',
          name: '67工具网-致力打造即用即走型在线工具箱',
          type: 'web',
        },
        { name: 'PDF派', target: 'https://www.pdfpai.com/', type: 'web' },
        {
          target: 'https://toolb.cn/textspeech',
          name: '文本转AI真人语音，免费微软AI语音 - 在线工具 - ToolB',
          type: 'web',
        },
        { target: 'http://www.yalijuda.com/', name: '压缩工具', type: 'web' },
        {
          name: '智影-用视频讲述你的故事',
          target: 'http://zenvideo.cn',
          type: 'web',
        },
        { target: 'https://jianlixiazai.cn/', name: '简历模板', type: 'web' },
        { target: 'https://123apps.com/', name: '在线视频操作', type: 'web' },
        {
          target: 'https://www.ghxi.com/',
          name: '果核剥壳 - 互联网的净土',
          type: 'web',
        },
        {
          target: 'https://www.ypppt.com/',
          name: 'PPT模板免费下载_精美免费PPT模板下载 -【优品PPT】',
          type: 'web',
        },
        {
          target: 'https://www.superso.top/Adobe/',
          name: 'Adobe CC 2022 Win/Mac破解版下载',
          type: 'web',
        },
        {
          target: 'https://www.zuxunlei.com/',
          name: '迅雷会员账号分享',
          type: 'web',
        },
        { target: 'https://jiemahao.com/', name: '在线接收短信验证码', type: 'web' },
        { target: 'https://www.fococlipping.com/', name: '抠图1', type: 'web' },
        { target: 'https://bgsub.cn/', name: '抠图3', type: 'web' },
        { target: 'https://www.remove.bg/', name: '抠图2', type: 'web' },
        {
          target: 'https://www.sojson.com/image2base64.html',
          name: '图片在线转换Base64 | 图片编码base64',
          type: 'web',
        },
        { target: 'https://xxxxx520.com/', name: 'Switch520', type: 'web' },
        {
          target: 'https://ourmacs.com/',
          name: 'OurMacs - Mac搜索引擎',
          type: 'web',
        },
        { target: 'https://rmsys.top/', name: '唯有入梦', type: 'web' },
        { name: 'Greasy', target: 'https://greasyfork.org/zh-CN', type: 'web' },
        {
          target: 'https://bar.ssstab.com/',
          name: '在线工具搜索',
          type: 'web',
        },
        {
          target: 'https://arc.tencent.com/zh/ai-demos/f',
          name: 'ARC官网-腾讯',
          type: 'web',
        },
        {
          target: 'https://www.uy5.net/',
          name: '克隆窝',
          type: 'web',
        },
        {
          target: 'https://video.ciding.cc/',
          name: '蜜蜂去水印',
          type: 'web',
        },
        {
          target: 'https://onlineconvertfree.com/zh/',
          name: '在线文件转换',
          type: 'web',
        },
      ],
    },
    {
      name: 'Code Manage',
      children: [
        { name: '码云Gitee', target: 'https://gitee.com/', type: 'web' },
        { name: 'GitHub', target: 'https://github.com/', type: 'web' },
        {
          name: 'TAPD',
          target: 'https://www.tapd.cn/my_worktable?left_tree=1',
          type: 'web',
        },
        {
          name: 'GitLab',
          target: 'http://120.78.201.189/users/sign_in',
          type: 'web',
        },
      ],
    },
    { target: 'https://hsr.hakush.in/', name: 'Hakush.in', type: 'web' },
    {
      name: '体育',
      children: [
        { target: 'https://pq8.live/live/3885', name: '盘球吧', type: 'web' },
        {
          target: 'http://bszb123.com/broadcast/lists/1',
          name: '比赛直播-NBA直播_电竞直播',
          type: 'web',
        },
        {
          target: 'https://www.betvictor139.com/',
          name: 'BETVICTOR伟德',
          type: 'web',
        },
        {
          target: 'https://guba.eastmoney.com/',
          name: '股吧_东方财富网旗下股票社区',
          type: 'web',
        },
        {
          target: 'https://live.leisu.com/',
          name: '足球比分_足球即时比分_雷速体育',
          type: 'web',
        },
        {
          target: 'https://www.williamhill911.com:9001/zh-cn',
          name: 'WilliamHill',
          type: 'web',
        },
      ],
    },
    {
      name: '游戏',
      children: [
        {
          target: 'https://www.gamer520.com/',
          name: 'Switch520 游戏',
          type: 'web',
        },
        {
          target: 'https://byrut.org/',
          name: '俄罗斯游戏下载',
          type: 'web',
        },
      ],
    },
    {
      target: 'https://trace.moe/',
      name: 'Anime Scene Search Engine - trace.moe',
      type: 'web',
    },
    {
      target: 'https://sms-activate.org/',
      name: 'SMS-Activate 虚拟号码服务',
      type: 'web',
    },
  ],
  [
    {
      name: '票务',
      children: [
        { target: 'https://www.urbtix.hk/', name: '城市售票网', type: 'web' },
        {
          target: 'https://www.cityline.com/',
          name: '購票通 Cityline',
          type: 'web',
        },
        { target: 'https://cn.cotaiticketing.com/', name: '金光票务', type: 'web' },
      ],
    },
    { target: 'https://www.poi86.com/', name: 'POI数据库', type: 'web' },
    {
      name: '游戏论坛',
      children: [
        {
          target: 'https://www.znbbs.vip/',
          name: '真牛论坛_游戏技术辅助资源网',
          type: 'web',
        },
        {
          target: 'https://www.wowan.vip/moregoods.html',
          name: '蜗玩交易平台',
          type: 'web',
        },
        { target: 'https://kayouba.cn/', name: 'K8', type: 'web' },
      ],
    },
    {
      target: 'https://www.fwvps.com/',
      name: '飞网_拨号vps',
      type: 'web',
    },
    {
      target:
        'https://www.digitalocean.com/community/tools/nginx?global.app.lang=zhCN',
      name: 'NGINXConfig | DigitalOcean',
      type: 'web',
    },
    { target: 'https://xfltd.cc/', name: '养鸡场', type: 'web' },
    { target: 'http://doc.qianqian.club/', name: '软件大全', type: 'web' },
    {
      target: 'https://snippet-generator.app/',
      name: 'vscode代码片段',
      type: 'web',
    },
    {
      name: '流量卡',
      children: [
        {
          target: 'https://www.ksjhaoka.com/',
          name: '卡世界号卡管理系统',
          type: 'web',
        },
        {
          target: 'https://haoka.lot-ml.com/view/iframe.html',
          name: '172号卡分销系统',
          type: 'web',
        },
        {
          target: 'https://www.yuque.com/u34429180/diq87k',
          name: '172号卡 · 语雀',
          type: 'web',
        },
      ],
    },
    {
      target: 'http://345349720.ysepan.com/',
      name: '遥控器移动到目录那里去安装软件',
      type: 'web',
    },
    { target: 'https://home.nextapi.fun', name: 'Next API', type: 'web' },
    {
      name: 'coc',
      children: [
        {
          target: 'http://198.44.178.121/download.html',
          name: '爱玩Coc辅助脚本下载',
          type: 'web',
        },
        { target: 'https://zyq.today/cocdownload', name: 'coc下载', type: 'web' },
        {
          target: 'http://aiwan.eatuo.com:88/',
          name: '爱玩Coc免费辅助脚本',
          type: 'web',
        },
        {
          target: 'https://coc.heiyu100.cn/',
          name: '黑羽COC,部落冲突阵型分享链接',
          type: 'web',
        },
      ],
    },
    {
      target: 'https://www.silisilifun.com/',
      name: '嘶哩嘶哩 ~ (o\'.\'o) ~ silisili soso',
      type: 'web',
    },
    // The empty placeholder entry (target "http://") is skipped automatically.
  ],
  [
    {
      target: 'https://www.kkrb.net/',
      name: '三角洲行动一图流',
      type: 'web',
    },
    {
      target: 'https://v0.dev/chat',
      name: 'v0 by Vercel',
      type: 'web',
    },
  ],
];

(async function runInfinityImport() {
  const HUB_NAME = 'HubTabPinData';
  const OTHER_BOOKMARKS_ID = '2';

  function flatten(data) {
    if (!Array.isArray(data)) return [];
    if (data.length === 0) return [];
    if (Array.isArray(data[0])) return data.flat();
    return data;
  }

  function isValidWebItem(item) {
    if (!item || typeof item !== 'object') return false;
    if (item.type === 'app') return false;
    if (item.children) return false;
    const target = (item.target || '').trim();
    if (!target) return false;
    if (target === 'http://' || target === 'https://') return false;
    if (!/^https?:\/\//i.test(target)) return false;
    const name = (item.name || '').trim();
    if (!name) return false;
    return true;
  }

  function isFolder(item) {
    return item && typeof item === 'object' && Array.isArray(item.children);
  }

  function bk(method, ...args) {
    return new Promise((resolve, reject) => {
      method(...args, result => {
        const err = chrome.runtime?.lastError;
        if (err) reject(new Error(err.message));
        else resolve(result);
      });
    });
  }

  if (typeof chrome === 'undefined' || !chrome.bookmarks) {
    console.error(
      '[import] chrome.bookmarks API not available. Open this on the extension new tab page.'
    );
    return;
  }

  const matches = await bk(
    chrome.bookmarks.search.bind(chrome.bookmarks),
    { title: HUB_NAME }
  );
  let hub = matches.find(
    r => !r.url && r.parentId === OTHER_BOOKMARKS_ID && r.title === HUB_NAME
  );
  if (!hub) {
    hub = await bk(chrome.bookmarks.create.bind(chrome.bookmarks), {
      parentId: OTHER_BOOKMARKS_ID,
      title: HUB_NAME,
    });
    console.log(`[import] created ${HUB_NAME} (id=${hub.id})`);
  } else {
    console.log(`[import] reusing existing ${HUB_NAME} (id=${hub.id})`);
  }

  const existingUrls = new Set();
  const topChildren = await bk(
    chrome.bookmarks.getChildren.bind(chrome.bookmarks),
    hub.id
  );
  const folderIdByName = new Map();
  for (const c of topChildren) {
    if (c.url) existingUrls.add(c.url);
    else folderIdByName.set(c.title, c.id);
  }
  for (const fid of folderIdByName.values()) {
    const sub = await bk(
      chrome.bookmarks.getChildren.bind(chrome.bookmarks),
      fid
    );
    for (const s of sub) {
      if (s.url) existingUrls.add(s.url);
    }
  }

  const items = flatten(INFINITY_DATA);
  let pinsCreated = 0;
  let foldersCreated = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of items) {
    if (isFolder(item)) {
      const folderName = (item.name || '未命名文件夹').trim();
      let folderId = folderIdByName.get(folderName);
      if (!folderId) {
        try {
          const f = await bk(chrome.bookmarks.create.bind(chrome.bookmarks), {
            parentId: hub.id,
            title: folderName,
          });
          folderId = f.id;
          folderIdByName.set(folderName, folderId);
          foldersCreated++;
          console.log(`[import] + folder "${folderName}"`);
        } catch (e) {
          console.warn(`[import] failed to create folder "${folderName}":`, e);
          errors++;
          continue;
        }
      }
      for (const child of item.children) {
        if (!isValidWebItem(child)) {
          skipped++;
          continue;
        }
        const url = child.target.trim();
        const name = child.name.trim();
        if (existingUrls.has(url)) {
          skipped++;
          continue;
        }
        try {
          await bk(chrome.bookmarks.create.bind(chrome.bookmarks), {
            parentId: folderId,
            title: name,
            url,
          });
          existingUrls.add(url);
          pinsCreated++;
        } catch (e) {
          console.warn(`[import] failed to add "${name}":`, e);
          errors++;
        }
      }
    } else if (isValidWebItem(item)) {
      const url = item.target.trim();
      const name = item.name.trim();
      if (existingUrls.has(url)) {
        skipped++;
        continue;
      }
      try {
        await bk(chrome.bookmarks.create.bind(chrome.bookmarks), {
          parentId: hub.id,
          title: name,
          url,
        });
        existingUrls.add(url);
        pinsCreated++;
      } catch (e) {
        console.warn(`[import] failed to add "${name}":`, e);
        errors++;
      }
    } else {
      skipped++;
    }
  }

  console.log(
    `[import] done · ${foldersCreated} folders, ${pinsCreated} pins created · ` +
      `${skipped} skipped · ${errors} errors`
  );
  console.log(
    '[import] refresh the new tab page (Cmd/Ctrl+R) to see them in your SpeedDial.'
  );
})();

import type { Preferences } from "../shared/model";

export type Locale = Preferences["language"];
type Values = Record<string, string | number>;

const zhCN: Record<string, string> = {
  "Open Feeds in Orca to connect to your feed library.":
    "请在 Orca 中打开订阅，以连接你的订阅库。",
  "This action could not be completed.": "无法完成此操作。",
  Undated: "日期未知",
  now: "刚刚",
  "just now": "刚刚",
  Feeds: "订阅",
  "A LITTLE PERSPECTIVE": "换个角度看世界",
  "Refresh feeds": "刷新订阅",
  "Add a source": "添加来源",
  "Manage sources": "管理来源",
  "Refreshing your sources…": "正在刷新订阅来源…",
  "Your feeds, at your pace": "按自己的节奏阅读",
  "View sources": "查看来源",
  "Last successful update: {date}": "上次成功更新：{date}",
  "Opening your feeds…": "正在打开订阅…",
  "Your feeds are taking a moment": "订阅加载需要一点时间",
  "Try reconnecting to your library.": "请尝试重新连接订阅库。",
  "Try again": "重试",
  "Dismiss message": "关闭消息",
  "MAKE ROOM FOR CURIOSITY": "为好奇心留点空间",
  "A little news. A wider perspective.": "一点资讯，更广视野。",
  "Follow the stories and communities you care about. Save a good read for later, or ask an agent to help you make sense of it.":
    "关注你在意的报道和社区。收藏值得一读的内容，或请智能体帮你梳理脉络。",
  "Start with Hacker News": "从 Hacker News 开始",
  "Top stories from the community": "社区热门内容",
  "Follow an RSS feed": "关注 RSS 订阅",
  "Your favorite publications, together": "集中阅读喜爱的媒体",
  "Add a subreddit": "添加 subreddit",
  "A conversation worth following": "值得关注的讨论",
  "One quiet sidebar. Your subscriptions stay on this device.":
    "安静的一栏，订阅数据只保存在此设备上。",
  "Curated programming news": "精选编程资讯",
  "Engineering, infrastructure & security": "工程、基础设施与安全",
  "Official language news & releases": "官方语言动态与版本发布",
  "Developer tools & open source": "开发工具与开源",
  "Web standards & browser engineering": "Web 标准与浏览器工程",
  "Programming, careers & software teams": "编程、职业发展与软件团队",
  "Programming news & discussions": "编程资讯与讨论",
  "Web development & the tools behind it": "Web 开发与相关工具",
  "JavaScript news, libraries & projects": "JavaScript 资讯、库与项目",
  "TypeScript questions, tools & releases": "TypeScript 问题、工具与版本发布",
  "Rust language & ecosystem": "Rust 语言与生态",
  "Technology news & wider perspectives": "科技资讯与多元视角",
  "A few good feeds": "一些优质订阅",
  "Free developer feeds. Follow the ones you like.":
    "免费的开发者订阅，选择你喜欢的来关注。",
  "Good communities to explore": "值得探索的社区",
  "Programming and tech discussions. Follow hot stories.":
    "关注编程与科技讨论中的热门内容。",
  "Programming and tech discussions. Follow new stories.":
    "关注编程与科技讨论中的最新内容。",
  "Programming and tech discussions. Follow today’s top stories.":
    "关注编程与科技讨论中的今日最佳内容。",
  "Starter RSS feeds": "推荐 RSS 订阅",
  "Suggested subreddits": "推荐 subreddit",
  Following: "已关注",
  "Adding…": "正在添加…",
  Follow: "关注",
  "Feed filters": "订阅筛选",
  All: "全部",
  Saved: "已收藏",
  "Feed source": "订阅来源",
  "All sources": "全部来源",
  "Story order": "内容排序",
  "Source order": "来源顺序",
  Newest: "最新",
  "Find a story…": "搜索内容…",
  "Search headlines": "搜索标题",
  Unread: "未读",
  "Mark read": "标为已读",
  "Mark all items matching these filters read": "将当前筛选结果全部标为已读",
  "Your reading shelf": "你的收藏架",
  "No matching stories": "没有匹配的内容",
  "All caught up": "已经全部读完",
  "A moment between stories": "暂时没有新内容",
  "Save a headline and it will be waiting here, even after its feed moves on.":
    "收藏后，即使来源内容更新，它仍会留在这里。",
  "Try a different search or choose another source.": "换个关键词或选择其他来源。",
  "There are no unread stories in this view.": "当前视图没有未读内容。",
  "Refresh a source or add something new to follow.": "刷新来源，或添加新的关注内容。",
  "Show all stories": "显示全部内容",
  "News stories": "资讯列表",
  "More stories": "更多内容",
  "Saved story": "已收藏内容",
  "Publication date unavailable": "发布日期未知",
  "Publication date unavailable; first seen {date}": "发布日期未知；首次发现于 {date}",
  "By {author} · {date}": "作者：{author} · {date}",
  "Community thread": "社区讨论",
  "Story expanded.": "内容已展开。",
  "Story collapsed.": "内容已收起。",
  "Removed from saved reads.": "已从收藏中移除。",
  "Added to your reading shelf.": "已添加到收藏架。",
  "This story does not have a valid web link.": "此内容没有有效的网页链接。",
  "Link opening cancelled.": "已取消打开链接。",
  "Back to feeds": "返回订阅",
  "This feed shares the headline. Open the source for the full story, or ask an agent to explore it with you.":
    "此订阅只提供标题。请打开来源阅读全文，或请智能体帮你进一步了解。",
  "Open the discussion": "打开讨论",
  "Read the full story": "阅读全文",
  "Join the discussion": "参与讨论",
  "Close agent form": "关闭智能体表单",
  "Ask an agent": "询问智能体",
  "Save for later": "稍后阅读",
  "Mark unread": "标为未读",
  "Curate your corner.": "整理你的订阅角落。",
  "Keep the sources you love. Pause the ones you need a little less of.":
    "保留你喜爱的来源，暂时停用不常阅读的来源。",
  Paused: "已暂停",
  "Refreshing…": "正在刷新…",
  "Try later": "稍后重试",
  Refresh: "刷新",
  "Source name": "来源名称",
  "Save name": "保存名称",
  Remove: "移除",
  "Your next favorite source is waiting.": "下一个喜欢的来源正在等你。",
  "Make it yours": "个性化设置",
  "Auto refresh": "自动刷新",
  Manual: "手动",
  "Every 5 min": "每 5 分钟",
  "Every 10 min": "每 10 分钟",
  "Every 30 min": "每 30 分钟",
  "Every hour": "每小时",
  "Compact headlines": "紧凑标题",
  Language: "语言",
  English: "English",
  "Simplified Chinese": "简体中文",
  "Automatic refresh runs while you are focused in this panel. Saved stories stay available when a source is paused or removed.":
    "仅在此面板可见并获得焦点时自动刷新。来源暂停或移除后，已收藏内容仍会保留。",
  "Remove this source?": "移除此来源？",
  "Keep source": "保留来源",
  "Remove source": "移除来源",
  "Source removed. Saved stories kept.": "来源已移除，收藏内容已保留。",
  "FOLLOW A SOURCE": "关注来源",
  "Follow your curiosity.": "跟随你的好奇心。",
  "Follow a starter feed, or preview a source of your own.":
    "关注推荐订阅，或预览你自己的来源。",
  "RSS / Atom": "RSS / Atom",
  "Feed URL": "订阅地址",
  "Paste an RSS or Atom address from a publication you follow.":
    "粘贴你所关注媒体的 RSS 或 Atom 地址。",
  "Hacker News category": "Hacker News 分类",
  "Top stories": "热门内容",
  "New stories": "最新内容",
  "Best stories": "最佳内容",
  Subreddit: "Subreddit",
  Listing: "排序方式",
  Hot: "热门",
  New: "最新",
  "Top today": "今日最佳",
  "Public communities only. The discussion opens on Reddit.":
    "仅支持公开社区，讨论将在 Reddit 中打开。",
  "Preview source": "预览来源",
  "Finding a few good stories…": "正在查找一些优质内容…",
  "This feed is valid and currently has no entries.": "此订阅有效，但目前没有内容。",
  "Name in your sidebar": "侧边栏中的名称",
  "Follow this source": "关注此来源",
  "Added to your feeds.": "已添加到订阅。",
  "Choose another source": "选择其他来源",
  "A little more context.": "了解更多背景。",
  "Start a fresh conversation about this story.": "围绕此内容发起新对话。",
  "Your conversation is open": "对话已打开",
  "Your question was sent to a fresh {agent} chat in the selected workspace.":
    "你的问题已发送到所选工作区中的新 {agent} 对话。",
  "Your question was sent to a fresh {agent} terminal session in the selected workspace.":
    "你的问题已发送到所选工作区中的新 {agent} 终端会话。",
  "What would you like to know?": "你想了解什么？",
  "Why does this matter? What is the bigger picture?": "这为什么重要？更大的背景是什么？",
  "Explain the story": "解释这篇内容",
  "Why does it matter?": "它为什么重要？",
  "Check the claims": "核查关键说法",
  "Explain this story and give me the useful context.": "解释这篇内容，并提供有用的背景信息。",
  "Why does this story matter, and who is affected?": "这篇内容为什么重要？会影响谁？",
  "Check the key claims in this story against reliable sources.":
    "使用可靠来源核查这篇内容中的关键说法。",
  Workspace: "工作区",
  "Choose a workspace": "选择工作区",
  " · remote": " · 远程",
  " · paused": " · 已暂停",
  "Orca returned a partial workspace list. Choose a listed workspace.":
    "Orca 只返回了部分工作区，请从列表中选择。",
  "Loading your workspaces…": "正在加载工作区…",
  Agent: "智能体",
  "The selected agent must be set up in Orca. Opens a fresh conversation using its Chat or CLI setting.":
    "所选智能体必须已在 Orca 中配置。系统会按其聊天或 CLI 设置开启新对话。",
  "Starting your agent…": "正在启动智能体…",
  "Enter a question or choose one above.": "请输入问题或选择上方建议。",
  "Choose where to start the agent.": "请选择启动智能体的工作区。",
  "Your agent session has started.": "智能体会话已启动。",
  "Feeds preview · sample headlines": "订阅预览 · 示例标题",
  "Switch theme": "切换主题",
  "Preview width": "预览宽度",
  "This source needs a moment before another refresh.": "此来源需要稍等片刻才能再次刷新。",
  "Your sources are up to date.": "所有来源均为最新。",
};

let locale: Locale = "en";

export function setLocale(next: Locale) {
  locale = next;
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
    document.title = next === "zh-CN" ? zhCN.Feeds : "Feeds";
  }
}

export function getLocale(): Locale {
  return locale;
}

export function localeTag(): string {
  return locale === "zh-CN" ? "zh-CN" : "en";
}

function interpolate(message: string, values: Values) {
  return message.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

function pattern(next: Locale, text: string): string | undefined {
  let match: RegExpMatchArray | null;
  if ((match = text.match(/^(\d+) unread$/))) return `${match[1]} 条未读`;
  if ((match = text.match(/^(\d+) stories$/))) return `${match[1]} 篇内容`;
  if ((match = text.match(/^(\d+) saved reads$/))) return `${match[1]} 篇已收藏`;
  if ((match = text.match(/^(\d+) items marked read\.$/)))
    return `已将 ${match[1]} 项标为已读。`;
  if ((match = text.match(/^(\d+) sources?$/))) return `${match[1]} 个来源`;
  if ((match = text.match(/^(\d+) sources? could not update$/)))
    return `${match[1]} 个来源无法更新`;
  if ((match = text.match(/^Updated (.+) ago$/)))
    return `${translate(next, match[1])}前更新`;
  if ((match = text.match(/^(\d+)m$/))) return `${match[1]} 分钟`;
  if ((match = text.match(/^(\d+)h$/))) return `${match[1]} 小时`;
  if ((match = text.match(/^(\d+)d$/))) return `${match[1]} 天`;
  if ((match = text.match(/^Following (.+)\.$/))) return `已关注 ${match[1]}。`;
  if ((match = text.match(/^Following (.+)$/))) return `已关注 ${match[1]}`;
  if ((match = text.match(/^Follow (.+)$/))) return `关注 ${match[1]}`;
  if ((match = text.match(/^Enable (.+)$/))) return `启用 ${match[1]}`;
  if ((match = text.match(/^Edit (.+)$/))) return `编辑 ${match[1]}`;
  if ((match = text.match(/^(\d+) points on Hacker News$/)))
    return `Hacker News 上的 ${match[1]} 分`;
  if ((match = text.match(/^Publication date unavailable; first seen (.+)$/)))
    return `发布日期未知；首次发现于 ${match[1]}`;
  if ((match = text.match(/^(\d+) stor(?:y|ies) found\.?$/)))
    return `找到 ${match[1]} 篇内容${text.endsWith(".") ? "。" : ""}`;
  if ((match = text.match(/^Ask about (.+)$/))) return `询问有关“${match[1]}”的内容`;
  if ((match = text.match(/^Ask (.+)$/))) return `询问 ${match[1]}`;
  if (
    (match = text.match(
      /^You’ll stop following (.+)\. Your saved stories will stay on your reading shelf\.$/,
    ))
  )
    return `你将停止关注 ${match[1]}。已收藏内容仍会保留在收藏架中。`;
  if ((match = text.match(/^(.+) · paused$/))) return `${match[1]} · 已暂停`;
  if ((match = text.match(/^(.+) · remote$/))) return `${match[1]} · 远程`;
  return undefined;
}

export function translate(
  next: Locale,
  text: string,
  values: Values = {},
): string {
  if (next !== "zh-CN") return interpolate(text, values);
  return interpolate(zhCN[text] ?? pattern(next, text) ?? text, values);
}

export function t(text: string, values: Values = {}): string {
  return translate(locale, text, values);
}

export function formatDate(
  value: number | Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(localeTag(), options).format(value);
}

export function formatDateTime(value: number | Date): string {
  return new Intl.DateTimeFormat(localeTag(), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
}

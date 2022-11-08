import TelegramBot from "node-telegram-bot-api";
import * as dotenv from "dotenv";
import knex from "knex";
import * as dbConfig from "./knexfile";
import cache from "memory-cache";
import { get } from "lodash";
import Nueip from "./Nueip";
import moment from "moment";
import { CronJob } from "cron";

const sqlite = knex(dbConfig);

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const token = process.env.TELEGRAM_TOKEN;

if (!token) {
  throw new Error("Telegram token not found");
}

const bot = new TelegramBot(token, {
  polling: {
    interval: 5000,
    params: {
      limit: 5,
    },
  },
});

new CronJob("0 * 8,9,18 * * 1-5", checkNeedNotify, null, true, "Asia/Taipei");

bot.onText(/^\/offpunch$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  if (!userId) {
    bot.sendMessage(chatId, "無法取得您的使用者 ID");
    return;
  }

  const userData = await getUserData(userId);

  if (!userData.username || !userData.password) {
    bot.sendMessage(chatId, "請先設定帳號密碼");
    return;
  }

  const nueip = new Nueip(userData);
  await nueip.login();
  const result = await nueip.offpunch();

  if (result.status === "success") {
    bot.sendMessage(chatId, "下班打卡成功");
  } else {
    bot.sendMessage(chatId, "下班打卡失敗，建議手動執行");
  }

  const record = await nueip.getRecords();
  const [onPunch, offPunch] = processRecord(record);

  bot.sendMessage(chatId, `今日紀錄：\n上班：${onPunch}\n下班：${offPunch}`, {
    reply_markup: {
      remove_keyboard: true,
    },
  });
});

bot.onText(/^\/onpunch$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  if (!userId) {
    bot.sendMessage(chatId, "無法取得您的使用者 ID");
    return;
  }

  const userData = await getUserData(userId);

  if (!userData.username || !userData.password) {
    bot.sendMessage(chatId, "請先設定帳號密碼");
    return;
  }

  const nueip = new Nueip(userData);
  await nueip.login();
  const result = await nueip.onpunch();

  if (result.status === "success") {
    bot.sendMessage(chatId, "上班打卡成功");
  } else {
    bot.sendMessage(chatId, "上班打卡失敗，建議手動執行");
  }

  const record = await nueip.getRecords();
  const [onPunch, offPunch] = processRecord(record);

  bot.sendMessage(chatId, `今日紀錄：\n上班：${onPunch}\n下班：${offPunch}`, {
    reply_markup: {
      remove_keyboard: true,
    },
  });
});

bot.onText(/^\/record$/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  if (!userId) {
    bot.sendMessage(chatId, "無法取得您的使用者 ID");
    return;
  }

  const userData = await getUserData(userId);

  if (!userData.username) {
    bot.sendMessage(chatId, "請先設定您的帳號");
    return;
  }

  if (!userData.password) {
    bot.sendMessage(chatId, "請先設定您的密碼");
    return;
  }

  if (!userData.day_shift) {
    bot.sendMessage(chatId, "請先設定您的班別");
    return;
  }

  const nueip = new Nueip(userData);
  await nueip.login();

  const result = await nueip.getRecords();
  const now = moment().format("YYYY-MM-DD");
  const nueipId = Object.keys(get(result, ["data", now]))[0];
  const dataPath = ["data", now, nueipId, "punch"];

  const onPunch = get(result, [...dataPath, "onPunch", 0, "time"], null);
  const offPunch = get(result, [...dataPath, "offPunch", 0, "time"], null);

  const messages = ["打卡紀錄"];
  messages.push(`日期: ${now}`);
  messages.push(`上班時間: ${onPunch || "尚未打卡"}`);
  messages.push(`下班時間: ${offPunch || "尚未打卡"}`);

  bot.sendMessage(chatId, messages.join("\n"));
});

function processRecord(record: any) {
  const now = moment().format("YYYY-MM-DD");
  const nueipId = Object.keys(get(record, ["data", now]))[0];
  const dataPath = ["data", now, nueipId, "punch"];

  const onPunch = get(record, [...dataPath, "onPunch", 0, "time"], null);
  const offPunch = get(record, [...dataPath, "offPunch", 0, "time"], null);

  return [onPunch, offPunch];
}

bot.onText(/^\/me$/, async (msg) => {
  const userId = msg.from?.id;
  if (!userId) {
    bot.sendMessage(msg.chat.id, "無法取得您的使用者 ID");
    return;
  }

  const userData = await getUserData(userId);
  if (!userData.name) {
    const name = `${get(msg, "from.last_name", "")} ${get(
      msg,
      "from.first_name",
      ""
    )}`.trim();
    await updateUserData(userId, {
      ...userData,
      name,
    });
  }

  const messages = ["您的帳號資訊如下：", ""];

  messages.push(`暱稱：${userData.name || "未設定"}`);
  messages.push(`帳號：${userData.username || "未設定"}`);
  messages.push(`密碼：${userData.password || "未設定"}`);
  messages.push(`班別：${userData.day_shift || "未設定"}`);

  bot.sendMessage(msg.chat.id, messages.join("\n"), {
    reply_markup: {
      resize_keyboard: true,
      inline_keyboard: [
        [
          {
            text: "修改帳號",
            callback_data: "set_account",
          },
          {
            text: "修改暱稱",
            callback_data: "update_name",
          },
        ],
        [
          {
            text: "修改密碼",
            callback_data: "update_password",
          },
          {
            text: "修改班別",
            callback_data: "update_day_shift",
          },
        ],
      ],
    },
  });
});

bot.onText(/^\/state$/, (msg) => {
  const userId = msg.from?.id;
  if (!userId) {
    bot.sendMessage(msg.chat.id, "無法取得您的使用者 ID");
    return;
  }

  const state = getState(userId);
  bot.sendMessage(msg.chat.id, `目前狀態：${state || "無"}`);
});

bot.on("callback_query", (query) => {
  const chatId = query.message?.chat.id;

  if (!chatId) {
    return;
  }

  bot.answerCallbackQuery(query.id, {
    text: "OK, 請照著以下步驟操作",
  });
  switch (query.data) {
    case "set_account":
      bot.sendMessage(chatId, "請輸入您的打卡網站帳號");
      setState(query.from.id, "set_account");
      break;
    case "update_name":
      bot.sendMessage(chatId, "請輸入您的新暱稱");
      setState(query.from.id, "update_name");
      break;
    case "update_password":
      bot.sendMessage(chatId, "請輸入您的新密碼");
      setState(query.from.id, "update_password");
      break;
    case "update_day_shift":
      bot.sendMessage(chatId, "請選擇您的班別", {
        reply_markup: {
          resize_keyboard: true,
          one_time_keyboard: true,
          keyboard: [
            [
              {
                text: "9:00~18:00",
              },
              {
                text: "9:30~18:30",
              },
            ],
          ],
        },
      });
      setState(query.from.id, "update_day_shift");
      break;
  }
});

bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  if (!userId) {
    bot.sendMessage(chatId, "無法取得您的使用者 ID");
    return;
  }

  // escape bot command
  if (msg.text?.startsWith("/")) {
    return;
  }

  const state = getState(userId);

  switch (state) {
    case "set_account":
      setAccount(msg);
      break;
    case "update_password":
      updatePassword(msg);
      break;
    case "update_day_shift":
      setDayShift(msg);
      break;
  }
});

function getState(userId: number) {
  return cache.get(userId);
}

function setState(userId: number, state: string) {
  cache.put(userId, state);
}

async function setDayShift(msg: TelegramBot.Message) {
  const userId = msg.from?.id;
  if (!userId) {
    bot.sendMessage(msg.chat.id, "無法取得您的使用者 ID");
    return;
  }

  const userData = await getUserData(userId);
  const time = msg.text?.trim();

  if (!time) {
    bot.sendMessage(msg.chat.id, "請輸入您的班別");
    return;
  }

  await updateUserData(userId, {
    ...userData,
    day_shift: time,
  });

  bot.sendMessage(msg.chat.id, "已更新您的班別");
}

async function setAccount(msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  if (!userId) {
    bot.sendMessage(chatId, "無法取得您的使用者 ID");
    return;
  }

  const userData = await getUserData(userId);
  const inputUsername = msg.text;
  if (!inputUsername || /^[a-zA-z0-9]+$/.test(inputUsername) === false) {
    bot.sendMessage(chatId, "請確認您輸入的帳號格式是否正確");
    return;
  }

  await updateUserData(userId, {
    ...userData,
    username: inputUsername,
  });

  bot.sendMessage(chatId, "帳號設定完成");
  setState(userId, "");
}

async function updatePassword(msg: TelegramBot.Message) {
  const chatId = msg.chat.id;
  const userId = msg.from?.id;

  if (!userId) {
    bot.sendMessage(chatId, "無法取得您的使用者 ID");
    return;
  }

  const userData = await getUserData(userId);
  const inputPassword = msg.text;
  if (!inputPassword) {
    bot.sendMessage(chatId, "請確認您輸入的密碼格式是否正確");
    return;
  }

  await updateUserData(userId, {
    ...userData,
    password: inputPassword,
  });

  bot.sendMessage(chatId, "密碼設定完成");
  setState(userId, "");
}

async function updateUserData(userId: number, data: Checkout.User) {
  return sqlite("users").where({ user_id: userId.toString() }).update(data);
}

async function getUserData(userId: number): Promise<Checkout.User> {
  const user: Checkout.User = await sqlite("users")
    .where({ user_id: userId.toString() })
    .first();

  if (!user) {
    await initializeUser(userId.toString());
    return {
      user_id: userId.toString(),
    } as Checkout.User;
  }

  return user;
}

function initializeUser(userId: string) {
  return sqlite("users").insert({ user_id: userId });
}

async function checkNeedNotify() {
  const users: Checkout.User[] = await sqlite("users").select();
  const now = moment();

  for (const user of users) {
    if (!user.username || !user.password || !user.day_shift) {
      continue;
    }

    const [workAt, offWorkAt] = user.day_shift
      .split("~")
      .map((time) => moment(time, "HH:mm"));

    const cacheData = cache.get(user.user_id);

    if (cacheData) {
      // check if user already notify
      continue;
    }

    if (now.isBetween(workAt, workAt.clone().subtract(10, "minutes"))) {
      cache.put(user.user_id, "notify", 6 * 60 * 1000, handleCacheExpired);
      await bot.sendMessage(user.user_id, "需要進行上班打卡嗎？", {
        reply_markup: {
          resize_keyboard: true,
          one_time_keyboard: true,
          keyboard: [
            [
              {
                text: "/onpunch",
              },
              {
                text: "否",
              },
            ],
          ],
        },
      });
    }

    if (now.isBetween(offWorkAt, offWorkAt.clone().add(10, "minutes"))) {
      cache.put(user.user_id, "notify", 6 * 60 * 1000, handleCacheExpired);
      await bot.sendMessage(user.user_id, "需要進行下班打卡嗎？");
    }
  }
}

function handleCacheExpired(key: string, value: any) {
  console.log("cache expired", key, value);
}

bot.setMyCommands([
  {
    command: "/me",
    description: "開始使用打卡機器人的相關流程",
  },
  {
    command: "/state",
    description: "顯示目前的聊天狀態",
  },
  {
    command: "/record",
    description: "顯示打卡紀錄",
  },
  {
    command: "/onpunch",
    description: "上班打卡",
  },
  {
    command: "/offpunch",
    description: "下班打卡",
  },
]);

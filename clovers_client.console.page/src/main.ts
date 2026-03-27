import { CloversManager } from "./code/core";
import { init as chatInit } from "./code/chat";
import { init as userInit } from "./code/user";
import { init as groupInit } from "./code/sidebar/group";
// import { renderGroupList, showGroupChatHistory } from "./code/sidebar/group";

document.addEventListener("DOMContentLoaded", () => {
    console.log("Version: 0.1.0");
    const manager = new CloversManager();
    chatInit(manager);
    userInit(manager);
    groupInit(manager);
});


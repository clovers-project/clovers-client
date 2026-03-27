import { CloversManager } from "./code/core";
import { init as chatInit } from "./code/chat";
import { init as userInit } from "./code/user";
import { init as groupInit } from "./code/sidebar/group";
// import { renderGroupList, showGroupChatHistory } from "./code/sidebar/group";

document.addEventListener("DOMContentLoaded", () => {
    const manager = new CloversManager();
    chatInit(manager);
    userInit(manager);
    groupInit(manager);
});


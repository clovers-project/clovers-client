import os
import click
from pathlib import Path
from .config import Config, config, config_key


@click.group()
def main():
    """欢迎使用 Clovers CLI"""
    pass


def clovers_init():
    plugins_path: str = "./clovers_library"
    config["clovers"] = {
        "plugins_path": plugins_path,
        "plugins_list": [],
    }

    Path(plugins_path).mkdir(exist_ok=True, parents=True)
    config.save()


@main.command()
def init():
    clovers_init()


@main.command()
@click.argument("message")
def create(message: str):
    """创建一个 clovers 项目"""
    Path(message).mkdir()
    os.chdir(message)
    clovers_init()
    print(f"创建项目 {message} 成功")


@main.command()
@click.argument("message")
def install(message: str):
    config_data = Config.model_validate(config.get(config_key, {}))
    config_data.plugins_list.append(message)
    config[config_key] = config_data.model_dump()


@main.command()
@click.argument("message")
def uninstall(message: str):
    config_data = Config.model_validate(config.get(config_key, {}))
    try:
        config_data.plugins_list.remove(message)
        config[config_key] = config_data.model_dump()
    except ValueError:
        print(f"插件 {message} 不存在")


if __name__ == "__main__":
    main()

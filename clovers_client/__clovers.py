from pathlib import Path
from clovers import Leaf as BaseLeaf
from clovers.utils import list_modules


class Leaf(BaseLeaf):
    def load_adapters_from_list(self, adapter_list: list[str]):
        for adapter in adapter_list:
            if adapter.startswith("~"):
                adapter = ".".join((*self.__module__.split(".")[:-1], adapter[1:]))
            self.load_adapter(adapter)

    def load_adapters_from_dirs(self, adapter_dirs: list[str]):
        for adapter_dir in adapter_dirs:
            adapter_dir = Path(adapter_dir)
            if not adapter_dir.exists():
                adapter_dir.mkdir(parents=True, exist_ok=True)
                continue
            for adapter in list_modules(adapter_dir):
                self.load_adapter(adapter)

    def load_plugins_from_list(self, plugin_list: list[str]):
        for plugin in plugin_list:
            self.load_plugin(plugin)

    def load_plugins_from_dirs(self, plugin_dirs: list[str]):
        for plugin_dir in plugin_dirs:
            plugin_dir = Path(plugin_dir)
            if not plugin_dir.exists():
                plugin_dir.mkdir(parents=True, exist_ok=True)
                continue
            for plugin in list_modules(plugin_dir):
                self.load_plugin(plugin)

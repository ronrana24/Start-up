const MAP_SCRIPT_ID = "mappls-map-js";

export function loadMapplsSDK(token: string): Promise<any> {
  const win = window as any;
  if (win.mappls) return Promise.resolve(win.mappls);
  if (win.__mapplsPromise) return win.__mapplsPromise;

  win.__mapplsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(MAP_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => {
        // Assume plugins load shortly after
        setTimeout(() => resolve(win.mappls), 500);
      });
      return;
    }

    const script = document.createElement("script");
    script.id = MAP_SCRIPT_ID;
    script.src = `https://apis.mappls.com/advancedmaps/api/${token}/map_sdk?layer=vector&v=3.0`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const originalConsoleError = console.error;
      console.error = (...args) => {
        if (typeof args[0] === "string" && args[0].includes("Plugin fail to load")) {
          return;
        }
        originalConsoleError(...args);
      };

      const plugins = document.createElement("script");
      plugins.src = `https://apis.mappls.com/advancedmaps/api/${token}/map_sdk_plugins?v=3.0&libraries=search`;
      plugins.async = true;
      plugins.defer = true;
      plugins.onload = () => {
        console.error = originalConsoleError;
        resolve(win.mappls);
      };
      plugins.onerror = () => {
        console.error = originalConsoleError;
        reject(new Error("Mappls Plugins could not load"));
      };
      document.head.appendChild(plugins);
    };
    script.onerror = () => reject(new Error("Mappls Maps could not load"));
    document.head.appendChild(script);
  });

  return win.__mapplsPromise;
}

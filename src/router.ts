import type { TourRouter, Where } from "./steps";

// whereInHash is the route a URL's hash holds: "#/projects/p1?tab=tasks#L4" is /projects/p1, its
// query and its own hash, as a hash router reads it.
export function whereInHash(hash: string): Where {
  const u = new URL(hash.replace(/^#/, "") || "/", "https://demo.invalid");
  return { pathname: u.pathname, search: u.search, hash: u.hash };
}

// hashRouter is the tour's router for an app routed by the URL's hash, which a page opened as a
// file has to be: React Router's createHashRouter, Vue Router's createWebHashHistory, Angular's
// withHashLocation. It moves the app by setting the hash, as a click on a link would, and watches
// for the app's own moves, which a router makes with pushState and no event.
export function hashRouter(win: Window = window): TourRouter {
  return {
    navigate(to) {
      const want = to.startsWith("/") ? to : `/${to}`;
      if (win.location.hash.replace(/^#/, "") !== want) win.location.hash = want;
    },
    location: () => whereInHash(win.location.hash),
    subscribe(on) {
      let last = win.location.href;
      const check = () => {
        if (win.location.href === last) return;
        last = win.location.href;
        on();
      };
      win.addEventListener("hashchange", check);
      win.addEventListener("popstate", check);
      const every = win.setInterval(check, 200);
      return () => {
        win.removeEventListener("hashchange", check);
        win.removeEventListener("popstate", check);
        win.clearInterval(every);
      };
    },
  };
}

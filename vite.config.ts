import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig(({mode})=>({
  base: process.env.GITHUB_PAGES_BASE || (mode==='production' ? './' : '/'),
  plugins:[react(),VitePWA({registerType:'autoUpdate',includeAssets:['favicon.svg'],manifest:{name:'Ernährungstagebuch',short_name:'Ernährung',lang:'de',description:'Privates Ernährungstagebuch',theme_color:'#315c46',background_color:'#f8f7f3',display:'standalone',start_url:'./',scope:'./',icons:[{src:'icon-192.svg',sizes:'192x192',type:'image/svg+xml',purpose:'any'},{src:'icon-512.svg',sizes:'512x512',type:'image/svg+xml',purpose:'any'}]}})]
}));

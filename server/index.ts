import { createApp } from './app';

const port = Number(process.env.PORT ?? 3001);
createApp().listen(port, () => {
  console.log(`Model Council server listening on port ${port}`);
});

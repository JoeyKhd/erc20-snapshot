export const errorAndExit = (condition: string | number | null | undefined, message: string) => {
  if (!condition) {
    console.error(message);
    process.exit(1);
  }
};

export const sleep = (ms: number) => {
  return new Promise((resolve: any) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};

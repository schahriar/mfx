export const openURL = async (url: string) => {
  const res = await fetch(url);

  return res.body;
};

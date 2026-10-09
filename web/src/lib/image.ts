/** Načte obrázek ze souboru a zmenší ho na maxW px (data URL) – logo, fotky vzorů. */
export function readImage(file: File, maxW: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error("Obrázek se nepodařilo načíst"));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Obrázek se nepodařilo načíst"));
      img.onload = () => {
        const k = Math.min(1, maxW / img.width);
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k);
        cv.height = Math.round(img.height * k);
        cv.getContext("2d")!.drawImage(img, 0, 0, cv.width, cv.height);
        resolve(cv.toDataURL(file.type === "image/png" ? "image/png" : "image/jpeg", 0.85));
      };
      img.src = fr.result as string;
    };
    fr.readAsDataURL(file);
  });
}

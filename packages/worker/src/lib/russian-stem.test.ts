import { describe, expect, it } from "vitest";
import { buildKeywordRegex, isCyrillicKeyword, russianStem } from "./russian-stem.js";

function matches(tag: string, text: string): boolean {
  return buildKeywordRegex(tag).test(text.toLowerCase());
}

describe("russianStem", () => {
  it("срезает одно словоизменительное окончание", () => {
    expect(russianStem("атака")).toBe("атак");
    expect(russianStem("утечка")).toBe("утечк");
    expect(russianStem("уязвимость")).toBe("уязвим");
    expect(russianStem("контейнеры")).toBe("контейнер");
  });

  it("не режет слово до слишком короткого корня", () => {
    expect(russianStem("кии")).toBe("кии");
    expect(russianStem("бпла")).toBe("бпла");
  });

  it("оставляет слово без распознанного окончания как есть", () => {
    expect(russianStem("вредонос")).toBe("вредонос");
    expect(russianStem("фишинг")).toBe("фишинг");
  });
});

describe("buildKeywordRegex — русские словоформы", () => {
  // Ровно те промахи, что замерены на проде: тег «атака» ловил 3 статьи из 65.
  it("ловит падежные формы существительных", () => {
    for (const form of ["атака", "атаки", "атаку", "атакой", "атаках", "атакует"]) {
      expect(matches("атака", `Массовая ${form} на инфраструктуру`)).toBe(true);
    }
  });

  it("ловит формы «уязвимость»", () => {
    for (const form of ["уязвимость", "уязвимости", "уязвимостей", "уязвимый"]) {
      expect(matches("уязвимость", `Найдена ${form} в ядре`)).toBe(true);
    }
  });

  it("ловит прилагательные от «вредонос»", () => {
    expect(matches("вредонос", "обнаружено вредоносное ПО")).toBe(true);
    expect(matches("вредонос", "вредоносный код в пакете")).toBe(true);
  });

  it("ловит «шифрование» в других формах", () => {
    expect(matches("шифрование", "сквозное шифрования трафика")).toBe(true);
    expect(matches("шифрование", "данные зашифрованы")).toBe(false);
  });

  it("не ловит несвязанные слова с тем же началом", () => {
    expect(matches("соболь", "соболезнования семье пострадавшего")).toBe(false);
    expect(matches("атака", "атакадемический разбор")).toBe(false);
  });
});

describe("buildKeywordRegex — латиница и аббревиатуры остаются точными", () => {
  it("короткие аббревиатуры совпадают только целиком", () => {
    expect(matches("cve", "новый CVE-2026-1234")).toBe(true);
    expect(matches("cve", "cvector библиотека")).toBe(false);
    expect(matches("rce", "RCE в обработчике")).toBe(true);
    expect(matches("pam", "модуль PAM обновлён")).toBe(true);
    expect(matches("pam", "pampers")).toBe(false);
  });

  it("латинские слова не расширяются кириллическим хвостом", () => {
    expect(matches("linux", "Linux 6.12 released")).toBe(true);
    expect(matches("linux", "linuxoid")).toBe(false);
  });

  it("короткие кириллические теги матчатся точно", () => {
    expect(matches("кии", "объекты КИИ под защитой")).toBe(true);
    expect(matches("бпла", "перехват БПЛА")).toBe(true);
    expect(matches("бпла", "бпластик")).toBe(false);
  });
});

describe("isCyrillicKeyword", () => {
  it("отличает кириллицу от латиницы", () => {
    expect(isCyrillicKeyword("уязвимость")).toBe(true);
    expect(isCyrillicKeyword("mitre att&ck")).toBe(false);
    expect(isCyrillicKeyword("резервное копирование")).toBe(true);
  });
});

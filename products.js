// 単独のページ用の商品データ(Shopifyでは、商品の入力欄からセクションが同じ形のデータを作る)
// heightCm = 画像の上端〜下端の実寸。provisional = 仮の値。
// 背景写真を常設するとき: backgrounds: [{ id, title, type: "photo", image: "assets/backgrounds/xxx.jpg", viewCm: 250, x: 0.5, floorY: 0.9 }]
window.GREENPOT_DATA = {
  "greens": [
    {
      "id": "tree-210",
      "title": "樹木 210cm",
      "price": 0,
      "image": "assets/real/tree-210.webp",
      "heightCm": 210,
      "nurseryWcm": 15.5,
      "nurseryHcm": 14
    },
    {
      "id": "large-fakegreen-dracaena-warneckii-150cm",
      "title": "ドラセナ ワーネッキー 150cm",
      "price": 25300,
      "variantId": 48299401117748,
      "url": "https://and-garden-fakegreen.com/products/large-fakegreen-dracaena-warneckii-150cm",
      "image": "assets/green-dracaena.svg",
      "heightCm": 150,
      "nurseryWcm": 21,
      "nurseryHcm": 15,
      "provisional": [
        "image",
        "nurseryWcm",
        "nurseryHcm"
      ]
    },
    {
      "id": "eucalyptus-tree-real-wood",
      "title": "ユーカリツリー リアルウッド 130cm",
      "price": 25300,
      "variantId": 47008630931508,
      "url": "https://and-garden-fakegreen.com/products/eucalyptus-tree-real-wood",
      "image": "assets/green-eucalyptus.svg",
      "heightCm": 130,
      "nurseryWcm": 18,
      "nurseryHcm": 15,
      "provisional": [
        "image",
        "nurseryWcm",
        "nurseryHcm"
      ]
    },
    {
      "id": "large-fakegreen-ficus-benghalensis-145cm",
      "title": "フィカス・ベンガレンシス 145cm",
      "price": 26400,
      "variantId": 50482113118260,
      "url": "https://and-garden-fakegreen.com/products/large-fakegreen-ficus-benghalensis-145cm",
      "image": "assets/green-ficus.svg",
      "heightCm": 145,
      "nurseryWcm": 21,
      "nurseryHcm": 15,
      "provisional": [
        "image",
        "nurseryWcm",
        "nurseryHcm"
      ]
    }
  ],
  "pots": [
    {
      "id": "pot-30",
      "title": "鉢カバー Φ30×H30cm",
      "price": 0,
      "imageFront": "assets/real/pot-30.webp",
      "heightCm": 32.4,
      "mouthCm": 26,
      "innerBottomCm": 17,
      "rimY": 0.048,
      "soilDepthCm": 3,
      "_note": "真横からの1枚。外径Φ30が画像の幅いっぱい→画像の高さは32.4cm相当(上下の楕円を含む)"
    },
    {
      "id": "basic-fiber-clay-pot-no22-m-wh",
      "title": "BASICファイバークレイポット No.22 / M / WH",
      "price": 10560,
      "variantId": 48097548763188,
      "url": "https://and-garden-fakegreen.com/products/basic-fiber-clay-pot-no22-m-wh",
      "imageBack": "assets/pot-basic22-back.svg",
      "imageFront": "assets/pot-basic22-front.svg",
      "heightCm": 37.9,
      "mouthCm": 25,
      "rimY": 0.057,
      "ellipseRatio": 0.16,
      "soilDepthCm": 4,
      "provisional": [
        "imageBack",
        "imageFront"
      ]
    },
    {
      "id": "cylinder-plain-pot-no1-m-br",
      "title": "CYLINDERプレーンポット No.1 / M / BR",
      "price": 14520,
      "variantId": 48033216233524,
      "url": "https://and-garden-fakegreen.com/products/cylinder-plain-pot-no1-m-br",
      "imageBack": "assets/pot-cylinder1-back.svg",
      "imageFront": "assets/pot-cylinder1-front.svg",
      "heightCm": 34.6,
      "mouthCm": 25,
      "rimY": 0.067,
      "ellipseRatio": 0.16,
      "soilDepthCm": 4,
      "provisional": [
        "imageBack",
        "imageFront"
      ]
    },
    {
      "id": "standard-cement-pot-no7-m-glt",
      "title": "STANDARDセメントポット No.7 / M / GL",
      "price": 9240,
      "variantId": 46945126842420,
      "url": "https://and-garden-fakegreen.com/products/standard-cement-pot-no7-m-glt",
      "imageBack": "assets/pot-cement7-back.svg",
      "imageFront": "assets/pot-cement7-front.svg",
      "heightCm": 37,
      "mouthCm": 28,
      "rimY": 0.0693,
      "ellipseRatio": 0.16,
      "soilDepthCm": 4,
      "provisional": [
        "imageBack",
        "imageFront"
      ]
    }
  ],
  "options": {
    "title": "草合体できて草",
    "lead": "グリーンと鉢カバーを選ぶと、植えたときの見た目と高さを確認できます。お部屋の写真を背景にすることもできます。",
    "rooms": true,
    "showTools": true,
    "cart": null
  }
};

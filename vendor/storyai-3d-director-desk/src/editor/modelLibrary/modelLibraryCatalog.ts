export type ModelLibraryCategoryId = "convenience" | "home" | "outdoor" | "tools" | "my-models";

export type ModelLibraryCategory = {
  directoryName: string;
  id: ModelLibraryCategoryId;
  label: string;
};

export type ModelLibraryItem = {
  categoryId: ModelLibraryCategoryId;
  fileName: string;
  id: string;
  name: string;
  thumbUrl?: string;
  url: string;
};

export const MODEL_LIBRARY_CATEGORIES: ModelLibraryCategory[] = [
  { id: "convenience", label: "便利生活", directoryName: "便利生活" },
  { id: "home", label: "居家生活", directoryName: "生活家居" },
  { id: "outdoor", label: "户外出行", directoryName: "户外出行" },
  { id: "tools", label: "工具配件", directoryName: "工具配件" },
  { id: "my-models", label: "我的模型", directoryName: "" },
];

const modelLibraryModules = import.meta.glob("../../../../模型库/**/*.fbx", {
  eager: true,
  import: "default",
  query: "?url",
}) as Record<string, string>;

const convenienceThumbnailModules = import.meta.glob(
  [
    "../../../../模型库/便利生活/缩略图/*.png",
    "../../../../模型库/便利生活/缩略图/*.jpg",
    "../../../../模型库/便利生活/缩略图/*.jpeg",
    "../../../../模型库/便利生活/缩略图/*.webp",
  ],
  {
    eager: true,
    import: "default",
    query: "?url",
  }
) as Record<string, string>;

const homeThumbnailModules = import.meta.glob(
  [
    "../../../../模型库/生活家居/缩略图/*.png",
    "../../../../模型库/生活家居/缩略图/*.jpg",
    "../../../../模型库/生活家居/缩略图/*.jpeg",
    "../../../../模型库/生活家居/缩略图/*.webp",
  ],
  {
    eager: true,
    import: "default",
    query: "?url",
  }
) as Record<string, string>;

const outdoorThumbnailModules = import.meta.glob(
  [
    "../../../../模型库/户外出行/缩略图/*.png",
    "../../../../模型库/户外出行/缩略图/*.jpg",
    "../../../../模型库/户外出行/缩略图/*.jpeg",
    "../../../../模型库/户外出行/缩略图/*.webp",
  ],
  {
    eager: true,
    import: "default",
    query: "?url",
  }
) as Record<string, string>;

const toolsThumbnailModules = import.meta.glob(
  [
    "../../../../模型库/工具配件/缩略图/*.png",
    "../../../../模型库/工具配件/缩略图/*.jpg",
    "../../../../模型库/工具配件/缩略图/*.jpeg",
    "../../../../模型库/工具配件/缩略图/*.webp",
  ],
  {
    eager: true,
    import: "default",
    query: "?url",
  }
) as Record<string, string>;

const MODEL_LIBRARY_NAME_MAP: Record<string, string> = {
  "2_liter_low.fbx": "两升饮料瓶",
  "A_sign_low.fbx": "A字提示牌",
  "ATM_low.fbx": "自动取款机",
  "arcade_low.fbx": "街机",
  "back_saw_low.fbx": "背锯",
  "backpack_low.fbx": "背包",
  "bandsaw_low.fbx": "带锯机",
  "basket_low.fbx": "购物篮",
  "basketball_hoop_low.fbx": "篮球架",
  "bathroom_sink_low.fbx": "浴室洗手台",
  "bathtub_low.fbx": "浴缸",
  "bed_low.fbx": "床",
  "beer_bottles_low.fbx": "啤酒瓶",
  "beer_cans_low.fbx": "啤酒罐",
  "belt_sander_low.fbx": "砂带机",
  "big_gulper_low.fbx": "大杯饮料机",
  "binoculars_low.fbx": "望远镜",
  "bleach_low.fbx": "漂白剂",
  "book_shelf_low.fbx": "书架",
  "bucket_low.fbx": "水桶",
  "bunk_bed_low.fbx": "双层床",
  "bunny_low.fbx": "兔子",
  "cabinet_low.fbx": "储物柜",
  "cactus_low.fbx": "仙人掌",
  "camper_low.fbx": "露营车",
  "camping_stove_low.fbx": "露营炉",
  "canoe_low.fbx": "独木舟",
  "canteen_low.fbx": "水壶",
  "carton_low.fbx": "纸盒",
  "cash_register_low.fbx": "收银机",
  "cat_low.fbx": "猫",
  "ceiling_fan_low.fbx": "吊扇",
  "cereal_box_low.fbx": "麦片盒",
  "chair_low.fbx": "椅子",
  "charcoal_grill_low.fbx": "炭烤炉",
  "cigarettes_and_lighter_low.fbx": "香烟与打火机",
  "cleaner_spray_low.fbx": "清洁喷雾",
  "coffee_carafe_low.fbx": "咖啡壶",
  "coffee_cup_low.fbx": "咖啡杯",
  "coffee_maker_low.fbx": "咖啡机",
  "coffee_table_low.fbx": "茶几",
  "computer_low.fbx": "电脑",
  "condiment_dispenser_low.fbx": "调料分配器",
  "cooking_pot_low.fbx": "炊锅",
  "cooler_low.fbx": "冷藏箱",
  "couch_low.fbx": "沙发",
  "credit_card_machine_low.fbx": "刷卡机",
  "crowbar_low.fbx": "撬棍",
  "cup_dispenser_low.fbx": "杯子分配器",
  "deer_skull_low.fbx": "鹿头骨",
  "desk_chair_low.fbx": "办公椅",
  "desk_lamp_low.fbx": "台灯",
  "desk_low.fbx": "书桌",
  "detergent_low.fbx": "洗涤剂",
  "dishwasher_low.fbx": "洗碗机",
  "display_cooler_low.fbx": "展示冷柜",
  "door_low.fbx": "门",
  "dresser_low.fbx": "梳妆柜",
  "drill_press_low.fbx": "台钻",
  "drink_fridge_low.fbx": "饮料冰柜",
  "dryer_low.fbx": "烘干机",
  "energy_can_low.fbx": "能量饮料罐",
  "entertainment_system_low.fbx": "影音柜",
  "fence_low.fbx": "围栏",
  "fire_low.fbx": "篝火",
  "fish_low.fbx": "鱼",
  "fish_tank_low.fbx": "鱼缸",
  "fishing_pole_low.fbx": "鱼竿",
  "flashlight_low.fbx": "手电筒",
  "folding_chair_low.fbx": "折叠椅",
  "foosball_table_low.fbx": "桌上足球",
  "french_press_low.fbx": "法压壶",
  "glass_soda_bottle_low.fbx": "玻璃汽水瓶",
  "grill_low.fbx": "烧烤炉",
  "Guitar_low.fbx": "吉他",
  "hammer_low.fbx": "锤子",
  "hand_saw_low.fbx": "手锯",
  "hatchet_low.fbx": "小斧头",
  "hotdog_roaster_low.fbx": "热狗烤炉",
  "Ice_cream_machine_low.fbx": "冰淇淋机",
  "Icebox_low.fbx": "冰柜",
  "Jar_low.fbx": "玻璃罐",
  "juice_bottle_low.fbx": "果汁瓶",
  "juice_machine_low.fbx": "果汁机",
  "kayak_low.fbx": "皮划艇",
  "ketchup_bottle_low.fbx": "番茄酱瓶",
  "kettle_low.fbx": "水壶锅",
  "kitchen_sink_low.fbx": "厨房水槽",
  "lantern_low.fbx": "营灯",
  "laundry_basket_low.fbx": "洗衣篮",
  "lighter_fluid_low.fbx": "点火油",
  "lounge_chair_low.fbx": "躺椅",
  "magazine_rack_low.fbx": "杂志架",
  "mailbox_low.fbx": "邮箱",
  "metal_canister_low.fbx": "金属罐",
  "microwave_low.fbx": "微波炉",
  "milk_low.fbx": "牛奶盒",
  "mixer_low.fbx": "搅拌机",
  "motor_oil_low.fbx": "机油瓶",
  "mustard_low.fbx": "芥末酱瓶",
  "nightstand_low.fbx": "床头柜",
  "oil_additive_low.fbx": "燃油添加剂",
  "open_sign_low.fbx": "营业标牌",
  "paint_can_low.fbx": "油漆桶",
  "paint_roller_low.fbx": "油漆滚筒",
  "pastry_case_low.fbx": "糕点展示柜",
  "picnic_table_low.fbx": "野餐桌",
  "picture_frame_low.fbx": "相框",
  "pipe_wrench_low.fbx": "管钳",
  "plant_low.fbx": "盆栽",
  "plastic_bottle_low.fbx": "塑料瓶",
  "plastic_water_bottle_low.fbx": "塑料水瓶",
  "pliers_low.fbx": "钳子",
  "popcicle_freezer_low.fbx": "冰棒冷柜",
  "power_drill_low.fbx": "电钻",
  "pretzel_warmer_low.fbx": "椒盐卷饼保温柜",
  "radiator_low.fbx": "暖气片",
  "record_low.fbx": "唱片",
  "refrigerator_low.fbx": "冰箱",
  "rotisserie_chicken_low.fbx": "烤鸡柜",
  "rubber_ducky_low.fbx": "橡皮鸭",
  "saw_horse_low.fbx": "锯木架",
  "scratch_awl_low.fbx": "划针",
  "screw_drivers_low.fbx": "螺丝刀组",
  "security_camera_low.fbx": "监控摄像头",
  "shelf_1_low.fbx": "货架1",
  "shelf_2_low.fbx": "货架2",
  "shelf_low.fbx": "工具架",
  "shop_broom_low.fbx": "工坊扫帚",
  "shop_drawer_low.fbx": "工具抽屉柜",
  "shop_light_low.fbx": "工坊灯",
  "shop_vac_low.fbx": "工业吸尘器",
  "shovel_low.fbx": "铲子",
  "shower_low.fbx": "淋浴间",
  "skewers_low.fbx": "烤串签",
  "skull_n_bones_low.fbx": "骷髅骨头",
  "sledge_hammer_low.fbx": "大锤",
  "sleeping_bags_low.fbx": "睡袋",
  "slurpy_cup_low.fbx": "冰沙杯",
  "slurpy_machine_low.fbx": "冰沙机",
  "small_clamp_low.fbx": "小夹具",
  "soap_low.fbx": "沐浴露",
  "soda_can_low.fbx": "汽水罐",
  "soda_cup_low.fbx": "汽水杯",
  "soda_machine_low.fbx": "汽水机",
  "speaker_low.fbx": "音箱",
  "spraypaint_low.fbx": "喷漆罐",
  "standing_lamp_low.fbx": "落地灯",
  "stool_low.fbx": "凳子",
  "stove_low.fbx": "炉灶",
  "straw_dispenser_low.fbx": "吸管盒",
  "stump_low.fbx": "树桩",
  "syrup_bottle_low.fbx": "糖浆瓶",
  "table_&_chairs_low.fbx": "餐桌椅",
  "table_clamp_low.fbx": "桌夹",
  "table_lamp_low.fbx": "桌灯",
  "tape_measure_low.fbx": "卷尺",
  "telescope_low.fbx": "天文望远镜",
  "tent_1_low.fbx": "帐篷1",
  "tent_2_low.fbx": "帐篷2",
  "tent_3_low.fbx": "帐篷3",
  "tent_4_low.fbx": "帐篷4",
  "thermus_low.fbx": "保温瓶",
  "Tin_Can_low.fbx": "锡罐",
  "tin_mug_low.fbx": "金属杯",
  "toilet_low.fbx": "马桶",
  "trashcan_low.fbx": "垃圾桶",
  "tree_saw_low.fbx": "树锯",
  "tuna_can_low.fbx": "金枪鱼罐头",
  "tv_low.fbx": "电视",
  "vacuum_low.fbx": "吸尘器",
  "vending_machine_low.fbx": "自动售货机",
  "vice_low.fbx": "台虎钳",
  "washer_low.fbx": "洗衣机",
  "water_tank_low.fbx": "水箱",
  "watering_can_low.fbx": "浇水壶",
  "window_low.fbx": "窗户",
  "wood_chizel_low.fbx": "木凿",
  "workbench_low.fbx": "工作台",
  "wrench_low.fbx": "扳手",
};

const MODEL_LIBRARY_THUMB_NAME_MAP: Record<string, string> = {
  "condiment_dispenser_low.fbx": "配料分配器",
  "detergent_low.fbx": "洗调剂",
  "display_cooler_low.fbx": "展示冰柜",
};

const UPDATED_MODEL_THUMBNAIL_OVERRIDES: Record<string, string> = {
  "deer_skull_low.fbx": new URL("../../../../模型库/户外出行/缩略图/鹿头骨.png", import.meta.url).href,
  "drill_press_low.fbx": new URL("../../../../模型库/工具配件/缩略图/台钻.png", import.meta.url).href,
  "thermus_low.fbx": new URL("../../../../模型库/户外出行/缩略图/保温瓶.png", import.meta.url).href,
};

function createModelName(fileName: string) {
  const mappedName = MODEL_LIBRARY_NAME_MAP[fileName];
  if (mappedName) return mappedName;

  return fileName
    .replace(/\.(fbx|obj)$/i, "")
    .replace(/_low$/i, "")
    .replace(/_/g, " ")
    .replace(/\b[a-z]/g, (match) => match.toUpperCase());
}

function createModelThumbnailName(fileName: string) {
  return MODEL_LIBRARY_THUMB_NAME_MAP[fileName] ?? createModelName(fileName);
}

export function getModelLibraryItems() {
  const categoriesByDirectory = new Map(
    MODEL_LIBRARY_CATEGORIES.map((category) => [category.directoryName, category])
  );
  const createThumbnailsByName = (thumbnailModules: Record<string, string>) =>
    new Map(
      Object.entries(thumbnailModules).map(([path, url]) => {
        const fileName = path.split("/").pop() ?? path;
        const thumbnailName = fileName.replace(/\.(png|jpe?g|webp)$/i, "");

        return [thumbnailName, url];
      })
    );
  const thumbnailsByCategoryId = new Map<ModelLibraryCategoryId, Map<string, string>>([
    ["convenience", createThumbnailsByName(convenienceThumbnailModules)],
    ["home", createThumbnailsByName(homeThumbnailModules)],
    ["outdoor", createThumbnailsByName(outdoorThumbnailModules)],
    ["tools", createThumbnailsByName(toolsThumbnailModules)],
  ]);

  return Object.entries(modelLibraryModules)
    .map(([path, url]) => {
      const [, directoryName, fileName] = path.match(/模型库\/([^/]+)\/([^/]+)$/) ?? [];
      const category = categoriesByDirectory.get(directoryName);

      if (!category || !fileName) return null;
      const name = createModelName(fileName);
      const thumbUrl =
        UPDATED_MODEL_THUMBNAIL_OVERRIDES[fileName] ??
        thumbnailsByCategoryId.get(category.id)?.get(createModelThumbnailName(fileName));

      return {
        categoryId: category.id,
        fileName,
        id: `${category.id}:${fileName}`,
        name,
        url,
        ...(thumbUrl ? { thumbUrl } : {}),
      } satisfies ModelLibraryItem;
    })
    .filter((item): item is ModelLibraryItem => item !== null)
    .sort((a, b) => {
      const categoryIndexA = MODEL_LIBRARY_CATEGORIES.findIndex((category) => category.id === a.categoryId);
      const categoryIndexB = MODEL_LIBRARY_CATEGORIES.findIndex((category) => category.id === b.categoryId);

      if (categoryIndexA !== categoryIndexB) return categoryIndexA - categoryIndexB;

      return a.name.localeCompare(b.name);
    });
}

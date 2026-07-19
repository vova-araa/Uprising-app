export interface Studio {
  id: string;
  nameKey: string;
  descKey: string;
  pricePerHour: number;
  equipment: string[];
  image: string;
}

export interface TimeSlot {
  id: string;
  time: string;
  available: boolean;
}

export interface Service {
  id: string;
  nameKey: string;
  description: string;
  descriptionEn: string;
  price: string;
  priceEn: string;
  requestOnly: boolean;
  icon: string;
}

export const studios: Studio[] = [
  {
    id: "studio-1",
    nameKey: "studio1",
    descKey: "studio1Desc",
    pricePerHour: 50,
    equipment: ["Neumann TLM103", "Focusrite Scarlett", "Adams A77X", "Arturia Piano", "Meerdere gitaren"],
    image: "",
  },
  {
    id: "studio-2",
    nameKey: "studio2",
    descKey: "studio2Desc",
    pricePerHour: 30,
    equipment: ["Adams A77X", "Yamaha HS7", "Akai Mini Keyboard", "Focusrite Scarlett"],
    image: "",
  },
  {
    id: "content-room",
    nameKey: "contentRoom",
    descKey: "contentRoomDesc",
    pricePerHour: 35,
    equipment: ["Camera", "LED Panels", "Green Screen", "White Screen", "Black Screen", "Teleprompter", "Podcast Setup"],
    image: "",
  },
];

export const generateTimeSlots = (): TimeSlot[] => {
  const slots: TimeSlot[] = [];
  for (let h = 0; h < 24; h++) {
    slots.push({
      id: `slot-${h}`,
      time: `${h.toString().padStart(2, "0")}:00`,
      available: true,
    });
  }
  return slots;
};

export const services: Service[] = [
  {
    id: "music-studio",
    nameKey: "musicStudio",
    description: "Professionele opnames in een state-of-the-art studio met topapparatuur.",
    descriptionEn: "Professional recordings in a state-of-the-art studio with top equipment.",
    price: "Vanaf €30/uur",
    priceEn: "From €30/hour",
    requestOnly: false,
    icon: "Mic",
  },
  {
    id: "content-space",
    nameKey: "contentSpace",
    description: "Creatieve ruimte voor foto, video en podcast productie.",
    descriptionEn: "Creative space for photo, video and podcast production.",
    price: "Vanaf €35/uur",
    priceEn: "From €35/hour",
    requestOnly: false,
    icon: "Camera",
  },
  {
    id: "mix-master",
    nameKey: "mixMasterService",
    description: "Professionele mix en mastering voor je tracks.",
    descriptionEn: "Professional mixing and mastering for your tracks.",
    price: "Vanaf €150",
    priceEn: "From €150",
    requestOnly: true,
    icon: "Sliders",
  },
  {
    id: "producer",
    nameKey: "producer",
    description: "Werk samen met ervaren producers aan je volgende hit.",
    descriptionEn: "Collaborate with experienced producers on your next hit.",
    price: "€350 per single",
    priceEn: "€350 per single",
    requestOnly: true,
    icon: "Music",
  },
  {
    id: "photography",
    nameKey: "photography",
    description: "Professionele fotografie en content creatie voor artiesten.",
    descriptionEn: "Professional photography and content creation for artists.",
    price: "Op aanvraag",
    priceEn: "On request",
    requestOnly: true,
    icon: "Image",
  },
  {
    id: "clothing",
    nameKey: "clothing",
    description: "Custom kleding en merchandise ontwerp en productie.",
    descriptionEn: "Custom clothing and merchandise design and production.",
    price: "Op aanvraag",
    priceEn: "On request",
    requestOnly: true,
    icon: "Shirt",
  },
  {
    id: "merch",
    nameKey: "merchandise",
    description: "Volledig merchandise beheer voor artiesten en merken.",
    descriptionEn: "Full merchandise management for artists and brands.",
    price: "Op aanvraag",
    priceEn: "On request",
    requestOnly: true,
    icon: "Package",
  },
];

export interface Booking {
  id: string;
  studioId: string;
  studioName: string;
  date: string;
  startTime: string;
  endTime: string;
  extras: string[];
  total: number;
  status: "upcoming" | "completed" | "cancelled";
}

export const mockBookings: Booking[] = [
  {
    id: "b1",
    studioId: "studio-1",
    studioName: "Studio 1",
    date: "2026-03-12",
    startTime: "14:00",
    endTime: "17:00",
    extras: ["Producer"],
    total: 135,
    status: "upcoming",
  },
  {
    id: "b2",
    studioId: "content-room",
    studioName: "Content Room",
    date: "2026-03-08",
    startTime: "10:00",
    endTime: "12:00",
    extras: [],
    total: 70,
    status: "completed",
  },
  {
    id: "b3",
    studioId: "studio-2",
    studioName: "Studio 2",
    date: "2026-03-05",
    startTime: "18:00",
    endTime: "21:00",
    extras: ["Mix & Master"],
    total: 90,
    status: "completed",
  },
];

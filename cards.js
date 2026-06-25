/*
  CARD IMAGE SETTINGS

  1. Copy your image files into this website folder.
  2. Add filenames to the matching card below.

  Example:
  makeCard(1, "card-01-front.jpg", "card-01-back.jpg")

  Leave either filename blank ("") to keep the numbered design.
*/
function makeCard(number, frontImage = "", backImage = "") {
  return {
    frontImage,
    backImage,
    frontLabel: String(number),
    backLabel: `Card ${number}`,
  };
}

const CARD_DATA = [
  makeCard(1, "", "stella.jpg"),
  makeCard(2, "", ""),
  makeCard(3, "", ""),
  makeCard(4, "", ""),
  makeCard(5, "", ""),
  makeCard(6, "", ""),
  makeCard(7, "", ""),
  makeCard(8, "", ""),
  makeCard(9, "", ""),
  makeCard(10, "", ""),
  makeCard(11, "", ""),
  makeCard(12, "", ""),
  makeCard(13, "", ""),
  makeCard(14, "", ""),
  makeCard(15, "", ""),
  makeCard(16, "", ""),
  makeCard(17, "", ""),
  makeCard(18, "", ""),
  makeCard(19, "", ""),
  makeCard(20, "", ""),
];

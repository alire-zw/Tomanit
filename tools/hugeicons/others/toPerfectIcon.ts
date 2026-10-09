import fs from 'fs'
const iconsPath = './downloaded/stroke-rounded/'
const outputPath = './icons/stroke-rounded/'

// make the directory if it doesn't exist
if (!fs.existsSync(outputPath)) {
  fs.mkdirSync(outputPath)
}

const fillColor = {
  form: `fill="#141B34"`,
  to: `fill="currentColor"`,
}

const strokeWidth = {
  form: `stroke-width="1.5"`,
  to: `stroke-width="1.7"`,
}

const strokeColor = {
  from: `stroke="#141B34"`,
  to: `stroke="currentColor"`,
}

let count = 0
fs.readdirSync(iconsPath).forEach((file) => {
  console.log(`${count}.\t ${file}`)
  const icon = fs.readFileSync(`${iconsPath}${file}`, 'utf8')
  const newIcon = icon
    .replace(new RegExp(fillColor.form, 'g'), fillColor.to)
    .replace(new RegExp(strokeWidth.form, 'g'), strokeWidth.to)
    .replace(new RegExp(strokeColor.from, 'g'), strokeColor.to)
  fs.writeFileSync(`${outputPath}${file}`, newIcon)
  count++
})

import { assetUrl } from '../utils/assets'

export default function FrogMark({ size = 42 }) {
  return (
    <span className="frog-mark" style={{ width: size, height: size }} aria-hidden="true">
      <img src={assetUrl('favicon.svg')} alt="" />
    </span>
  )
}

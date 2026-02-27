import React, { useEffect } from 'react'
import { Helmet } from 'react-helmet-async'

const SEO = ({
  title,
  description,
  image = 'https://stryumcmeavlvjaamcaw.supabase.co/storage/v1/object/public/crews/default-share.jpg',
  url = 'https://carmeetesp.netlify.app',
  type = 'website',
}) => {
  const siteTitle = title.includes('CarMeet') ? title : `${title} | CarMeet ESP`

  useEffect(() => {
    document.title = siteTitle
  }, [siteTitle])

  return (
    <Helmet prioritizeSeoTags>
      <title>{siteTitle}</title>
      <meta name='description' content={description} />

      {/* Open Graph (Facebook, WhatsApp, LinkedIn) */}
      <meta property='og:url' content={url} />
      <meta property='og:type' content={type} />
      <meta property='og:title' content={siteTitle} />
      <meta property='og:description' content={description} />
      <meta property='og:image' content={image} />

      {/* Twitter Cards */}
      <meta name='twitter:card' content='summary_large_image' />
      <meta name='twitter:url' content={url} />
      <meta name='twitter:title' content={siteTitle} />
      <meta name='twitter:description' content={description} />
      <meta name='twitter:image' content={image} />
    </Helmet>
  )
}

export default SEO

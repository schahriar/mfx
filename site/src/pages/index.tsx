import clsx from 'clsx';
import Link from '@docusaurus/Link';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';
import video from "@site/static/img/video.webm";

import styles from './index.module.css';
import { useEffect } from 'react';

function HomepageHeader() {
  const {siteConfig} = useDocusaurusContext();
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div>
        <video src={video} autoPlay muted/>
        <p className="disclaimer">
          video generated using MFX (edge detection convolution filter)
        </p>
      </div>
      <div className="container" style={{
        zIndex: 10
      }}>
        <Heading as="h1" className="hero__title">
          {siteConfig.title}
        </Heading>
        <p className="hero__subtitle">{siteConfig.tagline}</p>
        <div className={styles.buttons}>
          <Link
            className="button button--secondary button--lg"
            to="/docs/intro">
            Tutorial - 15min ⏱️
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();

  useEffect(() => {
    document.body.setAttribute("data-page", "home");

    return () => {
      document.body.removeAttribute("data-page");
    };
  }, []);

  return (
    <Layout
      title={`MFX: Video Editing in the Browser`}
      description="Hardware-accelerated video editing right in the browser using javascript">
      <HomepageHeader />
    </Layout>
  );
}

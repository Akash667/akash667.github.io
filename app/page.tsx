import Image from "next/image";
import styles from "./page.module.css";

export default function Home() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <h1>Hi! I am Akash</h1>
      </main>
      <div   className={styles.oneliner}>
        I Create Pipelines on the Cloud
      </div>
      <div  className={styles.description} >
        R&D Engineer @ <a href="https://www.nokia.com">Nokia</a>, building E2E testing pipelines. I like working on Kuberetes and the cloud.
      </div>
      <div className={styles.ctas}>
        <a
          className={styles.primary}
          href="#"
          target="_blank"
          rel="noopener noreferrer"
        >
          Blog
        </a>
      </div>
      <footer className={styles.footer}>
        <a
          href="https://github.com/Akash667"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub
        </a>
        <a
          href="https://www.linkedin.com/in/akash667/"
          target="_blank"
          rel="noopener noreferrer"
        >
          LinkedIn
        </a>
      </footer>
    </div>
  );
}
